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
	WeaponID     string `json:"weaponId"`
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
	"idle_crouch",
	"walk_crouch",
	"walk_crouch_left_d",
	"walk_crouch_right_d",
	"backwards_crouch",
	"backwards_crouch_left_d",
	"backwards_crouch_right_d",
	"left_crouch",
	"right_crouch",
	"run_forward",
	"run_backward",
	"run_left",
	"run_right",
	"run_left_d",
	"run_right_d",
	"run_backward_left_d",
	"run_backward_right_d",
	"fire",
	"walk_fire",
	"walk_left_d_fire",
	"walk_right_d_fire",
	"backwards_fire",
	"backwards_left_d_fire",
	"backwards_right_d_fire",
	"left_fire",
	"right_fire",
	"idle_crouch_fire",
	"walk_crouch_fire",
	"walk_crouch_left_d_fire",
	"walk_crouch_right_d_fire",
	"backwards_crouch_fire",
	"backwards_crouch_left_d_fire",
	"backwards_crouch_right_d_fire",
	"left_crouch_fire",
	"right_crouch_fire",
	"run_forward_fire",
	"run_backward_fire",
	"run_left_fire",
	"run_right_fire",
	"run_left_d_fire",
	"run_right_d_fire",
	"run_backward_left_d_fire",
	"run_backward_right_d_fire",
	"jump_up",
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
	WeaponID   string  `json:"weaponId"`
}

type ReportKillPayload struct {
	VictimPlayerID string `json:"victimPlayerId"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
