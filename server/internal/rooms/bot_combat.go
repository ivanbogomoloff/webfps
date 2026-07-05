package rooms

import (
	"math"
	"math/rand"

	"web-fps/server/internal/match"
)

const (
	botMoveSpeed              = 5.0
	botCombatRange            = 40.0
	botCombatFovRad           = math.Pi * 2.0 / 3.0
	botWeaponSwitchCooldownMs = int64(8000)
	botArriveRadius           = 0.6
	botCombatStopDistance     = 6.0
)

var botWeaponIDs = []string{"rifle_m16", "rifle_ak47"}

var weaponMagazineByID = map[string]int{
	"rifle_m16":  12,
	"rifle_ak47": 30,
}

var weaponReloadMsByID = map[string]int64{
	"rifle_m16":  3000,
	"rifle_ak47": 2800,
}

func normalizeBotWeaponID(weaponID string) string {
	id := normalizeWeaponID(weaponID)
	if _, ok := weaponRulesByID[id]; ok {
		return id
	}
	return "rifle_ak47"
}

func botMagazineSize(weaponID string) int {
	if size, ok := weaponMagazineByID[normalizeBotWeaponID(weaponID)]; ok {
		return size
	}
	return 30
}

func botReloadMs(weaponID string) int64 {
	if ms, ok := weaponReloadMsByID[normalizeBotWeaponID(weaponID)]; ok {
		return ms
	}
	return 2800
}

func (m *Manager) botShootLocked(room *roomState, shooter *playerState, nowMs int64) {
	if room == nil || shooter == nil || shooter.IsDead || room.Phase != "running" {
		return
	}
	weaponID := normalizeBotWeaponID(shooter.WeaponID)
	weaponRule := weaponRulesByID[weaponID]
	minShotIntervalMs := int64(math.Ceil(1000.0 / math.Max(1.0, weaponRule.FireRate)))
	if shooter.LastShotAt > 0 && nowMs-shooter.LastShotAt < minShotIntervalMs {
		return
	}
	if shooter.BotAmmoInMag <= 0 {
		return
	}

	dirX := math.Sin(shooter.RotY)
	dirZ := math.Cos(shooter.RotY)
	originX := shooter.X
	originY := shooter.Y + playerEyeHeight
	originZ := shooter.Z

	var victim *playerState
	closestHitDistance := hitscanMaxDistance + 1
	for _, target := range room.Players {
		if target == nil || target.PlayerID == shooter.PlayerID || target.Role != "player" || target.IsDead {
			continue
		}
		targetCenterX, targetCenterY, targetCenterZ, targetRadius := resolvePlayerHitbox(target)
		hitDistance, ok := intersectRaySphere(
			originX, originY, originZ,
			dirX, 0, dirZ,
			targetCenterX, targetCenterY, targetCenterZ, targetRadius,
			hitscanMaxDistance,
		)
		if !ok || hitDistance >= closestHitDistance {
			continue
		}
		closestHitDistance = hitDistance
		victim = target
	}

	shooter.LastShotAt = nowMs
	shooter.LastShotSeq++
	shooter.BotAmmoInMag--

	if victim == nil {
		return
	}

	wasKilled := m.applyShotDamageLocked(room, shooter, victim, weaponRule.Damage, nowMs)
	hitPointX := originX + dirX*closestHitDistance
	hitPointY := originY
	hitPointZ := originZ + dirZ*closestHitDistance
	m.broadcastHitEffectLocked(room, shooter.PlayerID, victim.PlayerID, hitPointX, hitPointY, hitPointZ)
	if wasKilled {
		end := match.EvaluateEnd(match.EvaluateInput{
			FragLimit:  room.FragLimit,
			TimeLeft:   room.TimeLeftSec,
			Scoreboard: m.scoreboardLocked(room),
		})
		if end.Ended {
			m.finishMatchLocked(room, string(end.Reason), end.WinnerID)
		}
	}
}

func botYawToward(fromX, fromZ, toX, toZ float64) float64 {
	return math.Atan2(toX-fromX, toZ-fromZ)
}

func botInFov(rotY, fromX, fromZ, toX, toZ float64) bool {
	targetYaw := botYawToward(fromX, fromZ, toX, toZ)
	delta := targetYaw - rotY
	for delta > math.Pi {
		delta -= math.Pi * 2
	}
	for delta < -math.Pi {
		delta += math.Pi * 2
	}
	return math.Abs(delta) <= botCombatFovRad*0.5
}

func botLocomotionFromVelocity(rotY, vx, vz float64) string {
	cos := math.Cos(rotY)
	sin := math.Sin(rotY)
	ix := vx*cos - vz*sin
	iz := vx*sin + vz*cos
	const eps = 0.04
	var fz, fx float64
	if math.Abs(iz) > eps {
		fz = math.Copysign(1, iz)
	}
	if math.Abs(ix) > eps {
		fx = math.Copysign(1, ix)
	}
	if fz == 0 && fx == 0 {
		return "idle"
	}
	if fz > 0 && fx != 0 {
		if fx > 0 {
			return "walk_left_d"
		}
		return "walk_right_d"
	}
	if fz < 0 && fx != 0 {
		if fx > 0 {
			return "backwards_left_d"
		}
		return "backwards_right_d"
	}
	if math.Abs(fz) >= math.Abs(fx) {
		if fz > 0 {
			return "walk"
		}
		return "backwards"
	}
	if fx > 0 {
		return "left"
	}
	return "right"
}

func botFireLocomotion(base string) string {
	switch base {
	case "idle":
		return "fire"
	case "walk":
		return "walk_fire"
	case "walk_left_d":
		return "walk_left_d_fire"
	case "walk_right_d":
		return "walk_right_d_fire"
	case "backwards":
		return "backwards_fire"
	case "backwards_left_d":
		return "backwards_left_d_fire"
	case "backwards_right_d":
		return "backwards_right_d_fire"
	case "left":
		return "left_fire"
	case "right":
		return "right_fire"
	default:
		return "fire"
	}
}

func botFindTarget(room *roomState, bot *playerState) *playerState {
	if room == nil || bot == nil {
		return nil
	}
	var best *playerState
	bestDist := botCombatRange + 1
	for _, p := range room.Players {
		if p == nil || p.PlayerID == bot.PlayerID || p.Role != "player" || p.IsDead {
			continue
		}
		dx := p.X - bot.X
		dz := p.Z - bot.Z
		dist := math.Sqrt(dx*dx + dz*dz)
		if dist > botCombatRange {
			continue
		}
		if best == nil || dist < bestDist {
			best = p
			bestDist = dist
		}
	}
	return best
}

func botPickRandomWeapon(rng *rand.Rand, current string) string {
	if len(botWeaponIDs) == 0 {
		return current
	}
	if len(botWeaponIDs) == 1 {
		return botWeaponIDs[0]
	}
	for {
		next := botWeaponIDs[rng.Intn(len(botWeaponIDs))]
		if next != current {
			return next
		}
	}
}
