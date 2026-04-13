package rooms

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"web-fps/server/internal/match"
	"web-fps/server/internal/protocol"
)

const (
	defaultPlayerHealth = 100
	debugHitDamage      = 25
	respawnDelayMs      = int64(3000)
	hitscanMaxDistance  = 120.0
	defaultHitboxRadius = 0.5
	defaultHitboxYOff   = 0.65
	playerEyeHeight     = 1.6
	maxOriginOffset     = 1.6
	maxShotPastAgeMs    = int64(1500)
	maxShotFutureMs     = int64(250)
)

type weaponRule struct {
	Damage   int
	FireRate float64
}

var weaponRulesByID = map[string]weaponRule{
	"rifle_m16":  {Damage: 20, FireRate: 3},
	"rifle_ak47": {Damage: 12, FireRate: 8},
}

type ClientSender interface {
	ID() string
	Send(msg any)
}

type mapManifest struct {
	Maps []struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		SpawnCount int    `json:"spawnCount"`
	} `json:"maps"`
}

type playerState struct {
	PlayerID    string  `json:"playerId"`
	Nickname    string  `json:"nickname"`
	ModelID     string  `json:"modelId"`
	WeaponID    string  `json:"weaponId"`
	Role        string  `json:"role"`
	Locomotion  string  `json:"locomotion"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Z           float64 `json:"z"`
	RotY        float64 `json:"rotY"`
	Frags       int     `json:"frags"`
	Deaths      int     `json:"deaths"`
	Health      int     `json:"health"`
	MaxHealth   int     `json:"maxHealth"`
	IsDead      bool    `json:"isDead"`
	RespawnAtMs int64   `json:"-"`
	ForcedLoc   string  `json:"forcedLocomotion,omitempty"`
	IsBot       bool    `json:"-"`
	LastShotSeq int64   `json:"-"`
	LastShotAt  int64   `json:"-"`
	HitboxCX    float64 `json:"-"`
	HitboxCY    float64 `json:"-"`
	HitboxCZ    float64 `json:"-"`
	HitboxR     float64 `json:"-"`
}

type roomState struct {
	Code          string
	OwnerPlayerID string
	MapID         string
	MaxPlayers    int
	TimeLimitSec  int
	FragLimit     int
	TimeLeftSec   int
	Phase         string
	WinnerID      string
	Players       map[string]*playerState
	Clients       map[string]ClientSender
}

type Manager struct {
	mu             sync.Mutex
	rooms          map[string]*roomState
	clientToRoom   map[string]string
	clientToPlayer map[string]string
	spawnByMap     map[string]int
	random         *rand.Rand
	botBehavior    BotBehavior
	nextPlayerInt  int
	nextBotInt     int
}

func NewManager(manifestPath string) (*Manager, error) {
	spawnByMap := map[string]int{"test2": 4}
	if manifestPath != "" {
		data, err := os.ReadFile(manifestPath)
		if err == nil {
			var mf mapManifest
			if err := json.Unmarshal(data, &mf); err == nil {
				for _, item := range mf.Maps {
					if item.ID != "" && item.SpawnCount > 0 {
						spawnByMap[item.ID] = item.SpawnCount
					}
				}
			}
		}
	}

	return &Manager{
		rooms:          make(map[string]*roomState),
		clientToRoom:   make(map[string]string),
		clientToPlayer: make(map[string]string),
		spawnByMap:     spawnByMap,
		random:         rand.New(rand.NewSource(time.Now().UnixNano())),
		botBehavior:    IdleBotBehavior{},
	}, nil
}

func (m *Manager) JoinRoom(client ClientSender, payload protocol.JoinRoomPayload) {
	m.mu.Lock()
	defer m.mu.Unlock()

	mapID := payload.MapID
	if mapID == "" {
		mapID = "test2"
	}
	roomCode := payload.RoomCode
	var room *roomState
	if roomCode == "" {
		roomCode = m.generateRoomCodeLocked()
	}
	room = m.rooms[roomCode]
	createdNewRoom := false
	if room == nil {
		createdNewRoom = true
		timeLimit := payload.TimeLimitSec
		fragLimit := payload.FragLimit
		if timeLimit <= 0 {
			timeLimit = 600
		}
		if fragLimit <= 0 {
			fragLimit = 25
		}
		maxPlayers := m.spawnByMap[mapID]
		if maxPlayers <= 0 {
			maxPlayers = 4
		}
		room = &roomState{
			Code:         roomCode,
			MapID:        mapID,
			MaxPlayers:   maxPlayers,
			TimeLimitSec: timeLimit,
			FragLimit:    fragLimit,
			TimeLeftSec:  timeLimit,
			Phase:        "waiting",
			Players:      make(map[string]*playerState),
			Clients:      make(map[string]ClientSender),
		}
		m.rooms[roomCode] = room
	}

	m.nextPlayerInt++
	playerID := fmt.Sprintf("p-%d", m.nextPlayerInt)
	nickname := payload.Nickname
	if nickname == "" {
		nickname = "Player"
	}
	modelID := payload.ModelID
	if modelID == "" {
		modelID = "player1"
	}
	weaponID := payload.WeaponID
	if weaponID == "" {
		weaponID = "rifle_m16"
	}

	room.Players[playerID] = &playerState{
		PlayerID:   playerID,
		Nickname:   nickname,
		ModelID:    modelID,
		WeaponID:   weaponID,
		Role:       "spectator",
		Locomotion: "idle",
		Health:     defaultPlayerHealth,
		MaxHealth:  defaultPlayerHealth,
		HitboxCX:   0,
		HitboxCY:   defaultHitboxYOff,
		HitboxCZ:   0,
		HitboxR:    defaultHitboxRadius,
	}
	if room.OwnerPlayerID == "" {
		room.OwnerPlayerID = playerID
	}
	room.Clients[client.ID()] = client
	m.clientToRoom[client.ID()] = roomCode
	m.clientToPlayer[client.ID()] = playerID

	if createdNewRoom {
		log.Printf("[rooms] created room code=%s mapId=%s maxPlayers=%d timeLimitSec=%d fragLimit=%d",
			room.Code, room.MapID, room.MaxPlayers, room.TimeLimitSec, room.FragLimit)
	} else {
		log.Printf("[rooms] player joined room code=%s playerId=%s nickname=%s client=%s (clients=%d)",
			room.Code, playerID, nickname, client.ID(), len(room.Clients))
	}

	client.Send(map[string]any{
		"type": protocol.TypeRoomJoined,
		"payload": map[string]any{
			"roomCode":      room.Code,
			"localPlayerId": playerID,
			"ownerPlayerId": room.OwnerPlayerID,
			"mapId":         room.MapID,
			"maxPlayers":    room.MaxPlayers,
		},
	})

	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypePlayerJoined,
		"payload": map[string]any{
			"playerId": playerID,
			"nickname": nickname,
			"modelId":  modelID,
			"weaponId": weaponID,
			"role":     "spectator",
		},
	})
	m.broadcastRoomStateLocked(room)
}

func (m *Manager) SetRole(clientID string, role string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, player := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil || player == nil {
		return
	}
	if role != "spectator" && role != "player" {
		m.sendErrorLocked(clientID, "invalid_role", "role must be spectator or player")
		return
	}
	if role == "player" && player.Role != "player" {
		if m.countActivePlayersLocked(room) >= room.MaxPlayers {
			m.sendErrorLocked(clientID, "room_full", "player slots are full for this map")
			return
		}
	}
	player.Role = role
	m.broadcastRoomStateLocked(room)
}

func (m *Manager) SpawnRequest(clientID string) {
	m.SetRole(clientID, "player")

	m.mu.Lock()
	defer m.mu.Unlock()
	room, _ := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil {
		return
	}
	if room.Phase == "waiting" && m.countActivePlayersLocked(room) > 0 {
		room.Phase = "running"
		room.TimeLeftSec = room.TimeLimitSec
		m.broadcastLocked(room, map[string]any{
			"type": protocol.TypeMatchStarted,
			"payload": map[string]any{
				"startedAtUnixMs": time.Now().UnixMilli(),
				"timeLimitSec":    room.TimeLimitSec,
				"fragLimit":       room.FragLimit,
			},
		})
		go m.runRoomTimer(room.Code)
	}
}

func (m *Manager) AddBot(clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, _ := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil {
		return
	}
	requestPlayerID := m.clientToPlayer[clientID]
	if requestPlayerID == "" || requestPlayerID != room.OwnerPlayerID {
		m.sendErrorLocked(clientID, "forbidden", "only room owner can add bot")
		return
	}
	if m.countActivePlayersLocked(room) >= room.MaxPlayers {
		m.sendErrorLocked(clientID, "room_full", "player slots are full for this map")
		return
	}

	m.nextBotInt++
	botID := fmt.Sprintf("bot-%d", m.nextBotInt)
	spawnX, spawnY, spawnZ, spawnRotY := m.pickBotSpawnLocked(room)
	bot := &playerState{
		PlayerID:   botID,
		Nickname:   fmt.Sprintf("Bot %d", m.nextBotInt),
		ModelID:    "player1",
		WeaponID:   "rifle_ak47",
		Role:       "player",
		Locomotion: "idle",
		X:          spawnX,
		Y:          spawnY,
		Z:          spawnZ,
		RotY:       spawnRotY,
		Health:     defaultPlayerHealth,
		MaxHealth:  defaultPlayerHealth,
		IsBot:      true,
		HitboxCX:   spawnX,
		HitboxCY:   spawnY + defaultHitboxYOff,
		HitboxCZ:   spawnZ,
		HitboxR:    defaultHitboxRadius,
	}
	room.Players[botID] = bot
	m.applyBotBehaviorLocked(room, time.Now().UnixMilli())

	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypePlayerJoined,
		"payload": map[string]any{
			"playerId": bot.PlayerID,
			"nickname": bot.Nickname,
			"modelId":  bot.ModelID,
			"weaponId": bot.WeaponID,
			"role":     bot.Role,
		},
	})
	m.broadcastPlayerStatesLocked(room)
	m.broadcastRoomStateLocked(room)
}

func (m *Manager) UpdateState(clientID string, payload protocol.StateUpdatePayload) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, player := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil || player == nil {
		return
	}
	respawnStateChanged := m.applyRespawnsLocked(room, time.Now().UnixMilli())
	player.X = payload.X
	player.Y = payload.Y
	player.Z = payload.Z
	player.RotY = payload.RotY
	if payload.Role == "player" || payload.Role == "spectator" {
		player.Role = payload.Role
	}
	if payload.WeaponID != "" {
		player.WeaponID = payload.WeaponID
	}
	if !player.IsDead {
		player.Locomotion = protocol.NormalizePlayerLocomotion(payload.Locomotion)
	}
	if payload.Hitbox != nil {
		player.HitboxCX = payload.Hitbox.Center.X
		player.HitboxCY = payload.Hitbox.Center.Y
		player.HitboxCZ = payload.Hitbox.Center.Z
		player.HitboxR = math.Max(0.1, payload.Hitbox.Radius)
	} else {
		player.HitboxCX = player.X
		player.HitboxCY = player.Y + defaultHitboxYOff
		player.HitboxCZ = player.Z
		player.HitboxR = defaultHitboxRadius
	}

	m.broadcastPlayerStatesLocked(room)
	if respawnStateChanged {
		m.broadcastRoomStateLocked(room)
	}
}

func (m *Manager) ReportKill(clientID string, payload protocol.ReportKillPayload) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, killer := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil || killer == nil || room.Phase != "running" {
		return
	}
	victim := room.Players[payload.VictimPlayerID]
	if victim == nil || victim.PlayerID == killer.PlayerID {
		return
	}

	killer.Frags++
	victim.Deaths++
	victim.Health = victim.MaxHealth
	victim.IsDead = false
	victim.RespawnAtMs = 0
	victim.ForcedLoc = ""
	m.broadcastScoreboardLocked(room)

	end := match.EvaluateEnd(match.EvaluateInput{
		FragLimit:  room.FragLimit,
		TimeLeft:   room.TimeLeftSec,
		Scoreboard: m.scoreboardLocked(room),
	})
	if end.Ended {
		m.finishMatchLocked(room, string(end.Reason), end.WinnerID)
	}
}

func (m *Manager) DebugHitSelf(clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, player := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil || player == nil {
		return
	}
	if player.Role != "player" || player.IsDead {
		return
	}

	healthBefore := player.Health
	if healthBefore <= 0 {
		healthBefore = player.MaxHealth
	}
	player.Health = max(0, healthBefore-debugHitDamage)

	if player.Health <= 0 {
		player.Health = 0
		player.IsDead = true
		player.Deaths++
		if isCrouchLocomotion(player.Locomotion) {
			player.ForcedLoc = "death_crouch"
		} else {
			player.ForcedLoc = "death_back"
		}
		player.Locomotion = player.ForcedLoc
		player.RespawnAtMs = time.Now().UnixMilli() + respawnDelayMs
		m.broadcastScoreboardLocked(room)
	}

	m.broadcastPlayerStatesLocked(room)
}

func (m *Manager) HandleShot(clientID string, payload protocol.PlayerShotPayload) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, shooter := m.getRoomAndPlayerByClientLocked(clientID)
	if room == nil || shooter == nil || room.Phase != "running" {
		return
	}
	nowMs := time.Now().UnixMilli()
	respawnStateChanged := m.applyRespawnsLocked(room, nowMs)
	if shooter.Role != "player" || shooter.IsDead {
		if respawnStateChanged {
			m.broadcastPlayerStatesLocked(room)
			m.broadcastRoomStateLocked(room)
		}
		return
	}

	weaponID := normalizeWeaponID(shooter.WeaponID)
	if payload.WeaponID != "" && normalizeWeaponID(payload.WeaponID) != weaponID {
		return
	}
	weaponRule := weaponRulesByID[weaponID]

	if payload.Seq > 0 && payload.Seq <= shooter.LastShotSeq {
		return
	}
	minShotIntervalMs := int64(math.Ceil(1000.0 / math.Max(1.0, weaponRule.FireRate)))
	if shooter.LastShotAt > 0 && nowMs-shooter.LastShotAt < minShotIntervalMs {
		return
	}
	if payload.ClientTime > 0 {
		if nowMs-payload.ClientTime > maxShotPastAgeMs {
			return
		}
		if payload.ClientTime-nowMs > maxShotFutureMs {
			return
		}
	}

	dx := payload.Direction.X
	dy := payload.Direction.Y
	dz := payload.Direction.Z
	lenSq := dx*dx + dy*dy + dz*dz
	if lenSq <= 1e-6 {
		return
	}
	invLen := 1.0 / math.Sqrt(lenSq)
	dx *= invLen
	dy *= invLen
	dz *= invLen

	shooterCenterX, shooterCenterY, shooterCenterZ, shooterRadius := resolvePlayerHitbox(shooter)
	originDx := payload.Origin.X - shooterCenterX
	originDy := payload.Origin.Y - (shooterCenterY + (playerEyeHeight - defaultHitboxYOff))
	originDz := payload.Origin.Z - shooterCenterZ
	maxOriginDistance := shooterRadius + maxOriginOffset
	if originDx*originDx+originDy*originDy+originDz*originDz > maxOriginDistance*maxOriginDistance {
		return
	}

	var victim *playerState
	closestHitDistance := hitscanMaxDistance + 1
	for _, target := range room.Players {
		if target == nil || target.PlayerID == shooter.PlayerID || target.Role != "player" || target.IsDead {
			continue
		}
		targetCenterX, targetCenterY, targetCenterZ, targetRadius := resolvePlayerHitbox(target)
		hitDistance, ok := intersectRaySphere(
			payload.Origin.X,
			payload.Origin.Y,
			payload.Origin.Z,
			dx,
			dy,
			dz,
			targetCenterX,
			targetCenterY,
			targetCenterZ,
			targetRadius,
			hitscanMaxDistance,
		)
		if !ok || hitDistance >= closestHitDistance {
			continue
		}
		closestHitDistance = hitDistance
		victim = target
	}

	shooter.LastShotSeq = max(shooter.LastShotSeq, payload.Seq)
	shooter.LastShotAt = nowMs

	if victim == nil {
		if respawnStateChanged {
			m.broadcastPlayerStatesLocked(room)
			m.broadcastRoomStateLocked(room)
		}
		return
	}

	wasKilled := m.applyShotDamageLocked(room, shooter, victim, weaponRule.Damage, nowMs)
	hitPointX := payload.Origin.X + dx*closestHitDistance
	hitPointY := payload.Origin.Y + dy*closestHitDistance
	hitPointZ := payload.Origin.Z + dz*closestHitDistance
	m.broadcastHitEffectLocked(room, shooter.PlayerID, victim.PlayerID, hitPointX, hitPointY, hitPointZ)
	m.broadcastPlayerStatesLocked(room)
	if respawnStateChanged {
		m.broadcastRoomStateLocked(room)
	}
	if !wasKilled {
		return
	}

	end := match.EvaluateEnd(match.EvaluateInput{
		FragLimit:  room.FragLimit,
		TimeLeft:   room.TimeLeftSec,
		Scoreboard: m.scoreboardLocked(room),
	})
	if end.Ended {
		m.finishMatchLocked(room, string(end.Reason), end.WinnerID)
	}
}

func (m *Manager) LeaveRoom(clientID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.removeClientLocked(clientID)
}

func (m *Manager) Disconnect(clientID string) {
	m.LeaveRoom(clientID)
}

func (m *Manager) runRoomTimer(roomCode string) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		m.mu.Lock()
		room := m.rooms[roomCode]
		if room == nil || room.Phase != "running" {
			m.mu.Unlock()
			return
		}
		respawnStateChanged := m.applyRespawnsLocked(room, time.Now().UnixMilli())
		m.applyBotBehaviorLocked(room, time.Now().UnixMilli())
		room.TimeLeftSec--
		m.broadcastLocked(room, map[string]any{
			"type": protocol.TypeMatchTick,
			"payload": map[string]any{
				"timeLeftSec": room.TimeLeftSec,
			},
		})

		end := match.EvaluateEnd(match.EvaluateInput{
			FragLimit:  room.FragLimit,
			TimeLeft:   room.TimeLeftSec,
			Scoreboard: m.scoreboardLocked(room),
		})
		if end.Ended {
			m.finishMatchLocked(room, string(end.Reason), end.WinnerID)
			m.mu.Unlock()
			return
		}
		if respawnStateChanged {
			m.broadcastPlayerStatesLocked(room)
			m.broadcastRoomStateLocked(room)
		}
		m.mu.Unlock()
	}
}

func (m *Manager) finishMatchLocked(room *roomState, reason string, winnerID string) {
	if room.Phase == "ended" {
		return
	}
	room.Phase = "ended"
	room.WinnerID = winnerID
	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypeMatchEnded,
		"payload": map[string]any{
			"winnerPlayerId": winnerID,
			"reason":         reason,
			"players":        m.scoreboardLocked(room),
		},
	})
	m.broadcastRoomStateLocked(room)
}

func (m *Manager) generateRoomCodeLocked() string {
	for i := 0; i < 10000; i++ {
		code := fmt.Sprintf("%04d", m.random.Intn(10000))
		if _, exists := m.rooms[code]; !exists {
			return code
		}
	}
	return fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
}

func (m *Manager) countActivePlayersLocked(room *roomState) int {
	count := 0
	for _, p := range room.Players {
		if p.Role == "player" {
			count++
		}
	}
	return count
}

func (m *Manager) broadcastLocked(room *roomState, msg any) {
	for _, client := range room.Clients {
		client.Send(msg)
	}
}

func (m *Manager) broadcastRoomStateLocked(room *roomState) {
	players := make([]map[string]any, 0, len(room.Players))
	for _, p := range room.Players {
		players = append(players, map[string]any{
			"playerId": p.PlayerID,
			"nickname": p.Nickname,
			"modelId":  p.ModelID,
			"weaponId": p.WeaponID,
			"role":     p.Role,
			"frags":    p.Frags,
			"deaths":   p.Deaths,
		})
	}

	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypeRoomState,
		"payload": map[string]any{
			"phase":         room.Phase,
			"timeLimitSec":  room.TimeLimitSec,
			"timeLeftSec":   room.TimeLeftSec,
			"fragLimit":     room.FragLimit,
			"ownerPlayerId": room.OwnerPlayerID,
			"players":       players,
		},
	})
	m.broadcastScoreboardLocked(room)
}

func (m *Manager) broadcastPlayerStatesLocked(room *roomState) {
	nowMs := time.Now().UnixMilli()
	states := make([]map[string]any, 0, len(room.Players))
	for _, p := range room.Players {
		locomotion := protocol.NormalizePlayerLocomotion(p.Locomotion)
		if p.IsDead && p.ForcedLoc != "" {
			locomotion = protocol.NormalizePlayerLocomotion(p.ForcedLoc)
		}
		respawnInSec := 0
		if p.IsDead && p.RespawnAtMs > 0 {
			respawnInSec = calcRespawnInSec(nowMs, p.RespawnAtMs)
		}
		forcedLoc := any(nil)
		if p.IsDead && p.ForcedLoc != "" {
			forcedLoc = p.ForcedLoc
		}
		states = append(states, map[string]any{
			"playerId":         p.PlayerID,
			"modelId":          p.ModelID,
			"weaponId":         p.WeaponID,
			"locomotion":       locomotion,
			"x":                p.X,
			"y":                p.Y,
			"z":                p.Z,
			"rotY":             p.RotY,
			"role":             p.Role,
			"frags":            p.Frags,
			"deaths":           p.Deaths,
			"health":           p.Health,
			"maxHealth":        p.MaxHealth,
			"isDead":           p.IsDead,
			"respawnInSec":     respawnInSec,
			"forcedLocomotion": forcedLoc,
		})
	}
	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypePlayerStateBag,
		"payload": map[string]any{
			"states": states,
		},
	})
}

func (m *Manager) broadcastHitEffectLocked(
	room *roomState,
	attackerPlayerID string,
	victimPlayerID string,
	x float64,
	y float64,
	z float64,
) {
	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypePlayerHitFX,
		"payload": map[string]any{
			"attackerPlayerId": attackerPlayerID,
			"victimPlayerId":   victimPlayerID,
			"point": map[string]float64{
				"x": x,
				"y": y,
				"z": z,
			},
		},
	})
}

func (m *Manager) applyRespawnsLocked(room *roomState, nowMs int64) bool {
	changed := false
	for _, p := range room.Players {
		if !p.IsDead || p.RespawnAtMs <= 0 || nowMs < p.RespawnAtMs {
			continue
		}
		p.IsDead = false
		p.Health = p.MaxHealth
		p.RespawnAtMs = 0
		p.ForcedLoc = ""
		p.Locomotion = "idle"
		changed = true
	}
	return changed
}

func calcRespawnInSec(nowMs int64, respawnAtMs int64) int {
	if respawnAtMs <= nowMs {
		return 0
	}
	return int((respawnAtMs - nowMs + 999) / 1000)
}

func isCrouchLocomotion(locomotion string) bool {
	return strings.Contains(locomotion, "crouch")
}

func normalizeWeaponID(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	if _, ok := weaponRulesByID[normalized]; ok {
		return normalized
	}
	return "rifle_m16"
}

func resolvePlayerHitbox(p *playerState) (centerX float64, centerY float64, centerZ float64, radius float64) {
	if p == nil {
		return 0, defaultHitboxYOff, 0, defaultHitboxRadius
	}
	r := p.HitboxR
	if r < 0.1 {
		r = defaultHitboxRadius
	}
	cx := p.HitboxCX
	cy := p.HitboxCY
	cz := p.HitboxCZ
	if cx == 0 && cy == 0 && cz == 0 {
		cx = p.X
		cy = p.Y + defaultHitboxYOff
		cz = p.Z
	}
	return cx, cy, cz, r
}

func intersectRaySphere(
	originX float64,
	originY float64,
	originZ float64,
	dirX float64,
	dirY float64,
	dirZ float64,
	centerX float64,
	centerY float64,
	centerZ float64,
	radius float64,
	maxDistance float64,
) (float64, bool) {
	lx := originX - centerX
	ly := originY - centerY
	lz := originZ - centerZ
	b := 2 * (lx*dirX + ly*dirY + lz*dirZ)
	c := lx*lx + ly*ly + lz*lz - radius*radius
	discriminant := b*b - 4*c
	if discriminant < 0 {
		return 0, false
	}
	sqrtDisc := math.Sqrt(discriminant)
	t0 := (-b - sqrtDisc) * 0.5
	t1 := (-b + sqrtDisc) * 0.5
	t := math.Inf(1)
	if t0 >= 0 {
		t = t0
	}
	if t1 >= 0 && t1 < t {
		t = t1
	}
	if !isFinite(t) || t > maxDistance {
		return 0, false
	}
	return t, true
}

func (m *Manager) applyShotDamageLocked(room *roomState, attacker *playerState, victim *playerState, damage int, nowMs int64) bool {
	if room == nil || attacker == nil || victim == nil || victim.IsDead {
		return false
	}
	if damage <= 0 {
		return false
	}
	healthBefore := victim.Health
	if healthBefore <= 0 {
		healthBefore = victim.MaxHealth
	}
	victim.Health = max(0, healthBefore-damage)
	if victim.Health > 0 {
		return false
	}

	victim.Health = 0
	victim.IsDead = true
	victim.Deaths++
	if isCrouchLocomotion(victim.Locomotion) {
		victim.ForcedLoc = "death_crouch"
	} else {
		victim.ForcedLoc = "death_back"
	}
	victim.Locomotion = victim.ForcedLoc
	victim.RespawnAtMs = nowMs + respawnDelayMs
	attacker.Frags++
	m.broadcastScoreboardLocked(room)
	return true
}

func isFinite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func (m *Manager) scoreboardLocked(room *roomState) []match.ScoreEntry {
	items := make([]match.ScoreEntry, 0, len(room.Players))
	for _, p := range room.Players {
		items = append(items, match.ScoreEntry{
			PlayerID: p.PlayerID,
			Nickname: p.Nickname,
			Frags:    p.Frags,
			Deaths:   p.Deaths,
		})
	}
	slices.SortStableFunc(items, func(a, b match.ScoreEntry) int {
		if a.Frags == b.Frags {
			if a.Deaths == b.Deaths {
				if a.Nickname < b.Nickname {
					return -1
				}
				if a.Nickname > b.Nickname {
					return 1
				}
				return 0
			}
			return a.Deaths - b.Deaths
		}
		return b.Frags - a.Frags
	})
	return items
}

func (m *Manager) broadcastScoreboardLocked(room *roomState) {
	m.broadcastLocked(room, map[string]any{
		"type": protocol.TypeScoreboard,
		"payload": map[string]any{
			"players": m.scoreboardLocked(room),
		},
	})
}

func (m *Manager) sendErrorLocked(clientID string, code string, message string) {
	roomCode := m.clientToRoom[clientID]
	room := m.rooms[roomCode]
	if room == nil {
		return
	}
	client := room.Clients[clientID]
	if client == nil {
		return
	}
	client.Send(map[string]any{
		"type": protocol.TypeError,
		"payload": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}

func (m *Manager) applyBotBehaviorLocked(room *roomState, nowMs int64) {
	if room == nil || m.botBehavior == nil {
		return
	}
	for _, player := range room.Players {
		if !player.IsBot {
			continue
		}
		m.botBehavior.Apply(player, room, nowMs)
		player.HitboxCX = player.X
		player.HitboxCY = player.Y + defaultHitboxYOff
		player.HitboxCZ = player.Z
		player.HitboxR = defaultHitboxRadius
	}
}

func (m *Manager) pickBotSpawnLocked(room *roomState) (x float64, y float64, z float64, rotY float64) {
	if room == nil {
		return 0, 0, 0, 0
	}
	owner := room.Players[room.OwnerPlayerID]
	if owner != nil {
		return owner.X, owner.Y, owner.Z, owner.RotY
	}
	for _, p := range room.Players {
		if p == nil || p.IsBot || p.Role != "player" {
			continue
		}
		return p.X, p.Y, p.Z, p.RotY
	}
	for _, p := range room.Players {
		if p == nil || p.IsBot {
			continue
		}
		return p.X, p.Y, p.Z, p.RotY
	}
	return 0, 0, 0, 0
}

func (m *Manager) getRoomAndPlayerByClientLocked(clientID string) (*roomState, *playerState) {
	roomCode := m.clientToRoom[clientID]
	room := m.rooms[roomCode]
	if room == nil {
		return nil, nil
	}
	client := room.Clients[clientID]
	if client == nil {
		return nil, nil
	}
	playerID := m.clientToPlayer[clientID]
	player := room.Players[playerID]
	return room, player
}

func (m *Manager) removeClientLocked(clientID string) {
	roomCode := m.clientToRoom[clientID]
	room := m.rooms[roomCode]
	if room == nil {
		delete(m.clientToRoom, clientID)
		delete(m.clientToPlayer, clientID)
		return
	}

	delete(room.Clients, clientID)
	delete(m.clientToRoom, clientID)
	playerID := m.clientToPlayer[clientID]
	delete(m.clientToPlayer, clientID)

	if playerID != "" {
		delete(room.Players, playerID)
		m.broadcastLocked(room, map[string]any{
			"type": protocol.TypePlayerLeft,
			"payload": map[string]any{
				"playerId": playerID,
			},
		})
	}
	m.broadcastRoomStateLocked(room)

	if len(room.Clients) == 0 {
		delete(m.rooms, roomCode)
		log.Printf("[rooms] closed room code=%s (no clients left)", roomCode)
	}
}
