package protocol

import "encoding/json"

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

type StateUpdatePayload struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Z      float64 `json:"z"`
	RotY   float64 `json:"rotY"`
	Role   string  `json:"role"`
	Frags  int     `json:"frags"`
	Deaths int     `json:"deaths"`
}

type ReportKillPayload struct {
	VictimPlayerID string `json:"victimPlayerId"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
