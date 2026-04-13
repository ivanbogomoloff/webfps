package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"web-fps/server/internal/protocol"
	"web-fps/server/internal/rooms"
)

type Hub struct {
	manager   *rooms.Manager
	clientSeq atomic.Int64
}

func NewHub(manager *rooms.Manager) *Hub {
	return &Hub{manager: manager}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true,
	})
	if err != nil {
		log.Printf("ws accept error: %v", err)
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "bye")

	clientID := "c-" + strconv.FormatInt(h.clientSeq.Add(1), 10)
	client := &clientConn{id: clientID, conn: conn}
	defer h.manager.Disconnect(clientID)

	for {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		var msg protocol.Message
		err := wsjson.Read(ctx, conn, &msg)
		cancel()
		if err != nil {
			return
		}
		h.routeMessage(client, msg)
	}
}

func (h *Hub) routeMessage(client *clientConn, msg protocol.Message) {
	switch msg.Type {
	case protocol.TypeJoinRoom:
		var payload protocol.JoinRoomPayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid join_room payload")
			return
		}
		h.manager.JoinRoom(client, payload)
	case protocol.TypeSetRole:
		var payload protocol.SetRolePayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid set_role payload")
			return
		}
		h.manager.SetRole(client.id, payload.Role)
	case protocol.TypeSpawnRequest:
		h.manager.SpawnRequest(client.id)
	case protocol.TypeAddBot:
		var payload protocol.AddBotPayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid add_bot payload")
			return
		}
		h.manager.AddBot(client.id)
	case protocol.TypeStateUpdate:
		var payload protocol.StateUpdatePayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid state_update payload")
			return
		}
		h.manager.UpdateState(client.id, payload)
	case protocol.TypePlayerShot:
		var payload protocol.PlayerShotPayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid player_shot payload")
			return
		}
		h.manager.HandleShot(client.id, payload)
	case protocol.TypeReportKill:
		var payload protocol.ReportKillPayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid report_kill payload")
			return
		}
		h.manager.ReportKill(client.id, payload)
	case protocol.TypeDebugHitSelf:
		var payload protocol.DebugHitSelfPayload
		if !decodePayload(msg.Payload, &payload) {
			h.sendError(client, "bad_payload", "invalid debug_hit_self payload")
			return
		}
		h.manager.DebugHitSelf(client.id)
	case protocol.TypeLeaveRoom:
		h.manager.LeaveRoom(client.id)
	default:
		h.sendError(client, "unknown_message", "unknown message type")
	}
}

func (h *Hub) sendError(client *clientConn, code string, message string) {
	client.Send(map[string]any{
		"type": protocol.TypeError,
		"payload": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

type clientConn struct {
	id   string
	conn *websocket.Conn
}

func (c *clientConn) ID() string {
	return c.id
}

func (c *clientConn) Send(msg any) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := wsjson.Write(ctx, c.conn, msg); err != nil {
		log.Printf("ws write error (%s): %v", c.id, err)
	}
}

func decodePayload(raw json.RawMessage, out any) bool {
	if len(raw) == 0 || string(raw) == "null" {
		return true
	}
	return json.Unmarshal(raw, out) == nil
}
