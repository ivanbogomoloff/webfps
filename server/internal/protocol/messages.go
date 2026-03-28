package protocol

import (
	"encoding/json"
	"slices"
)

const (
	TypeJoinRoom       = "join_room"
	TypeSetRole        = "set_role"
	TypeSpawnRequest   = "spawn_request"
	TypeStateUpdate    = "state_update"
	TypeReportKill     = "report_kill"
	TypeLeaveRoom      = "leave_room"
	TypeRoomJoined     = "room_joined"
	TypeRoomState      = "room_state"
	TypePlayerJoined   = "player_joined"
	TypePlayerLeft     = "player_left"
	TypeMatchStarted   = "match_started"
	TypeMatchTick      = "match_tick"
	TypePlayerStateBag = "player_state_batch"
	TypeScoreboard     = "scoreboard_update"
	TypeMatchEnded     = "match_ended"
	TypeError          = "error"
)

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type JoinRoomPayload struct {
	RoomCode     string `json:"roomCode"`
	Nickname     string `json:"nickname"`
	ModelID      string `json:"modelId"`
	MapID        string `json:"mapId"`
	TimeLimitSec int    `json:"timeLimitSec"`
	FragLimit    int    `json:"fragLimit"`
}

type SetRolePayload struct {
	Role string `json:"role"`
}

// PlayerLocomotionValues — допустимые значения поля locomotion в state_update / player_state_batch.
var PlayerLocomotionValues = []string{
	"idle",
	"walk",
	"walk_left_d",
	"walk_right_d",
	"backwards",
	"backwards_left_d",
	"backwards_right_d",
	"left",
	"right",
}

// NormalizePlayerLocomotion возвращает допустимую локомоцию или "idle".
func NormalizePlayerLocomotion(s string) string {
	if slices.Contains(PlayerLocomotionValues, s) {
		return s
	}
	return "idle"
}

type StateUpdatePayload struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Z          float64 `json:"z"`
	RotY       float64 `json:"rotY"`
	Role       string  `json:"role"`
	Frags      int     `json:"frags"`
	Deaths     int     `json:"deaths"`
	Locomotion string  `json:"locomotion"`
}

type ReportKillPayload struct {
	VictimPlayerID string `json:"victimPlayerId"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
