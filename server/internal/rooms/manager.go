package rooms

import (
	"encoding/json"
	"fmt"
	"log"
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
)

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
}

type roomState struct {
	Code         string
	MapID        string
	MaxPlayers   int
	TimeLimitSec int
	FragLimit    int
	TimeLeftSec  int
	Phase        string
	WinnerID     string
	Players      map[string]*playerState
	Clients      map[string]ClientSender
}

type Manager struct {
	mu             sync.Mutex
	rooms          map[string]*roomState
	clientToRoom   map[string]string
	clientToPlayer map[string]string
	spawnByMap     map[string]int
	random         *rand.Rand
	nextPlayerInt  int
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
			"phase":        room.Phase,
			"timeLimitSec": room.TimeLimitSec,
			"timeLeftSec":  room.TimeLeftSec,
			"fragLimit":    room.FragLimit,
			"players":      players,
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
			"playerId":   p.PlayerID,
			"modelId":    p.ModelID,
			"weaponId":   p.WeaponID,
			"locomotion": locomotion,
			"x":          p.X,
			"y":          p.Y,
			"z":          p.Z,
			"rotY":       p.RotY,
			"role":       p.Role,
			"frags":      p.Frags,
			"deaths":     p.Deaths,
			"health":     p.Health,
			"maxHealth":  p.MaxHealth,
			"isDead":     p.IsDead,
			"respawnInSec": respawnInSec,
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
	return int((respawnAtMs-nowMs + 999) / 1000)
}

func isCrouchLocomotion(locomotion string) bool {
	return strings.Contains(locomotion, "crouch")
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
