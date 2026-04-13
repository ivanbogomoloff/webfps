package rooms

import (
	"sync"
	"testing"

	"web-fps/server/internal/protocol"
)

type testClient struct {
	id string
	mu sync.Mutex
}

func (c *testClient) ID() string { return c.id }

func (c *testClient) Send(_ any) {}

func testHitboxAt(x float64, y float64, z float64) *protocol.Hitbox {
	return &protocol.Hitbox{
		Center: protocol.Vec3{X: x, Y: y + 1.6, Z: z},
		Radius: 0.5,
	}
}

func setupDuelRoom(t *testing.T) (*Manager, string, string, string) {
	t.Helper()
	manager, err := NewManager("")
	if err != nil {
		t.Fatalf("failed to create manager: %v", err)
	}
	c1 := &testClient{id: "c-1"}
	c2 := &testClient{id: "c-2"}

	manager.JoinRoom(c1, protocol.JoinRoomPayload{
		RoomCode: "1234", Nickname: "p1", WeaponID: "rifle_m16", ModelID: "player1",
	})
	manager.JoinRoom(c2, protocol.JoinRoomPayload{
		RoomCode: "1234", Nickname: "p2", WeaponID: "rifle_ak47", ModelID: "player1",
	})

	manager.SetRole(c1.id, "player")
	manager.SetRole(c2.id, "player")
	manager.SpawnRequest(c1.id)

	manager.mu.Lock()
	defer manager.mu.Unlock()
	p1 := manager.clientToPlayer[c1.id]
	p2 := manager.clientToPlayer[c2.id]
	return manager, p1, p2, c1.id
}

func TestHandleShotAppliesDamage(t *testing.T) {
	manager, shooterID, victimID, shooterClientID := setupDuelRoom(t)

	manager.UpdateState(shooterClientID, protocol.StateUpdatePayload{
		X: 0, Y: 0, Z: 0, RotY: 0, Role: "player", Locomotion: "idle", WeaponID: "rifle_m16", Hitbox: testHitboxAt(0, 0, 0),
	})
	manager.mu.Lock()
	var victimClientID string
	for clientID, playerID := range manager.clientToPlayer {
		if playerID == victimID {
			victimClientID = clientID
			break
		}
	}
	manager.mu.Unlock()
	manager.UpdateState(victimClientID, protocol.StateUpdatePayload{
		X: 0, Y: 0, Z: -10, RotY: 0, Role: "player", Locomotion: "idle", WeaponID: "rifle_ak47", Hitbox: testHitboxAt(0, 0, -10),
	})

	manager.HandleShot(shooterClientID, protocol.PlayerShotPayload{
		Origin:    protocol.Vec3{X: 0, Y: 1.6, Z: 0},
		Direction: protocol.Vec3{X: 0, Y: 0, Z: -1},
		WeaponID:  "rifle_m16",
		Seq:       1,
	})

	manager.mu.Lock()
	defer manager.mu.Unlock()
	room := manager.rooms["1234"]
	if room == nil {
		t.Fatal("room not found")
	}
	shooter := room.Players[shooterID]
	victim := room.Players[victimID]
	if shooter == nil || victim == nil {
		t.Fatal("players not found")
	}
	if victim.Health != 80 {
		t.Fatalf("expected victim health 80, got %d", victim.Health)
	}
	if shooter.Frags != 0 {
		t.Fatalf("expected shooter frags 0, got %d", shooter.Frags)
	}
}

func TestHandleShotRateLimitAndKill(t *testing.T) {
	manager, shooterID, victimID, shooterClientID := setupDuelRoom(t)

	manager.UpdateState(shooterClientID, protocol.StateUpdatePayload{
		X: 0, Y: 0, Z: 0, RotY: 0, Role: "player", Locomotion: "idle", WeaponID: "rifle_ak47", Hitbox: testHitboxAt(0, 0, 0),
	})
	manager.mu.Lock()
	var victimClientID string
	for clientID, playerID := range manager.clientToPlayer {
		if playerID == victimID {
			victimClientID = clientID
			break
		}
	}
	manager.mu.Unlock()
	manager.UpdateState(victimClientID, protocol.StateUpdatePayload{
		X: 0, Y: 0, Z: -6, RotY: 0, Role: "player", Locomotion: "idle", WeaponID: "rifle_m16", Hitbox: testHitboxAt(0, 0, -6),
	})

	manager.HandleShot(shooterClientID, protocol.PlayerShotPayload{
		Origin:    protocol.Vec3{X: 0, Y: 1.6, Z: 0},
		Direction: protocol.Vec3{X: 0, Y: 0, Z: -1},
		WeaponID:  "rifle_ak47",
		Seq:       1,
	})
	manager.HandleShot(shooterClientID, protocol.PlayerShotPayload{
		Origin:    protocol.Vec3{X: 0, Y: 1.6, Z: 0},
		Direction: protocol.Vec3{X: 0, Y: 0, Z: -1},
		WeaponID:  "rifle_ak47",
		Seq:       2,
	})

	manager.mu.Lock()
	room := manager.rooms["1234"]
	shooter := room.Players[shooterID]
	victim := room.Players[victimID]
	firstHealth := victim.Health
	manager.mu.Unlock()
	if firstHealth != 88 {
		t.Fatalf("expected single accepted shot by fire rate, health=88, got %d", firstHealth)
	}

	for seq := int64(3); seq <= 12; seq++ {
		manager.mu.Lock()
		shooter.LastShotAt = 0
		manager.mu.Unlock()
		manager.HandleShot(shooterClientID, protocol.PlayerShotPayload{
			Origin:    protocol.Vec3{X: 0, Y: 1.6, Z: 0},
			Direction: protocol.Vec3{X: 0, Y: 0, Z: -1},
			WeaponID:  "rifle_ak47",
			Seq:       seq,
		})
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	if victim.Health != 0 || !victim.IsDead {
		t.Fatalf("expected victim dead with zero health, got health=%d dead=%v", victim.Health, victim.IsDead)
	}
	if shooter.Frags < 1 {
		t.Fatalf("expected shooter to receive frag, got %d", shooter.Frags)
	}
}
