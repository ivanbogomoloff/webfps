package rooms

import (
	"math/rand"
)

type BotBehavior interface {
	Apply(bot *playerState, room *roomState, nowMs int64)
}

type CombatPatrolBotBehavior struct {
	RNG *rand.Rand
}

func (b CombatPatrolBotBehavior) Apply(bot *playerState, room *roomState, nowMs int64) {
	if bot == nil || room == nil || bot.IsDead || room.Phase != "running" {
		return
	}
	if b.RNG == nil {
		b.RNG = rand.New(rand.NewSource(nowMs))
	}

	dt := 0.1

	if bot.BotAmmoInMag <= 0 && !bot.BotIsReloading {
		bot.BotIsReloading = true
		bot.BotReloadUntilMs = nowMs + botReloadMs(bot.WeaponID)
		bot.Locomotion = "idle"
		return
	}
	if bot.BotIsReloading {
		if nowMs < bot.BotReloadUntilMs {
			bot.Locomotion = "idle"
			return
		}
		bot.BotIsReloading = false
		bot.BotAmmoInMag = botMagazineSize(bot.WeaponID)
	}

	if nowMs-bot.BotWeaponSwitchAt >= botWeaponSwitchCooldownMs && b.RNG.Float64() < 0.02 {
		nextWeapon := botPickRandomWeapon(b.RNG, bot.WeaponID)
		bot.WeaponID = nextWeapon
		bot.BotWeaponSwitchAt = nowMs
		bot.BotAmmoInMag = botMagazineSize(nextWeapon)
		bot.Locomotion = "idle"
		return
	}

	target := botFindTarget(room, bot)
	if target != nil {
		bot.BotTargetID = target.PlayerID
		botStepCombatChase(bot, target, dt)
		return
	}
	bot.BotTargetID = ""

	if room.BotNav == nil || len(room.BotNav.Waypoints) == 0 {
		bot.Locomotion = "idle"
		return
	}

	botStepPatrol(room.BotNav, bot, dt, b.RNG)
}
