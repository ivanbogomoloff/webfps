# FFA Protocol v1

This document defines JSON messages exchanged between client and server for
FFA multiplayer.

## Envelope

Every message has:

```json
{
  "type": "message_type",
  "payload": {}
}
```

## Client -> Server

- `join_room`
  - payload: `{ "roomCode": "1234", "nickname": "ivan", "modelId": "player1", "weaponId": "rifle_m16", "mapId": "test2", "timeLimitSec": 600, "fragLimit": 25 }`
- `set_role`
  - payload: `{ "role": "spectator" | "player" }`
- `spawn_request`
  - payload: `{}`
- `add_bot`
  - payload: `{}`
- `state_update`
  - payload: `{ "x": 0, "y": 0, "z": 0, "rotY": 0, "role": "spectator" | "player", "frags": 0, "deaths": 0, "locomotion": "idle" | "walk" | "walk_left_d" | "walk_right_d" | "backwards" | "backwards_left_d" | "backwards_right_d" | "left" | "right" | "idle_crouch" | "walk_crouch" | "walk_crouch_left_d" | "walk_crouch_right_d" | "backwards_crouch" | "backwards_crouch_left_d" | "backwards_crouch_right_d" | "left_crouch" | "right_crouch" | "run_forward" | "run_backward" | "run_left" | "run_right" | "run_left_d" | "run_right_d" | "run_backward_left_d" | "run_backward_right_d" | "jump_up", "weaponId": "rifle_m16", "hitbox": { "center": { "x": 0, "y": 1.1, "z": 0 }, "radius": 0.55 } }`
- `player_shot`
  - payload: `{ "origin": { "x": 0, "y": 1.6, "z": 0 }, "direction": { "x": 0, "y": 0, "z": -1 }, "weaponId": "rifle_m16", "seq": 42, "clientTime": 1710000000000 }`
- `report_kill`
  - payload: `{ "victimPlayerId": "p-2" }`
- `leave_room`
  - payload: `{}`

## Server -> Client

- `room_joined`
  - payload: `{ "roomCode": "1234", "localPlayerId": "p-1", "ownerPlayerId": "p-1", "mapId": "test2", "maxPlayers": 4 }`
- `room_state`
  - payload:
    - `phase`: `"waiting" | "running" | "ended"`
    - `timeLimitSec`, `timeLeftSec`, `fragLimit`
    - `ownerPlayerId`: creator of room (only this player can call `add_bot`)
    - `players`: array with `{ playerId, nickname, modelId, weaponId, role, frags, deaths }`
- `player_joined`
  - payload: `{ playerId, nickname, modelId, weaponId, role }`
- `player_left`
  - payload: `{ playerId }`
- `match_started`
  - payload: `{ startedAtUnixMs, timeLimitSec, fragLimit }`
- `match_tick`
  - payload: `{ timeLeftSec }`
- `player_state_batch`
  - payload: `{ states: [{ playerId, modelId, weaponId, locomotion, x, y, z, rotY, role, frags, deaths }] }`
- `player_hit_effect`
  - payload: `{ "attackerPlayerId": "p-1", "victimPlayerId": "p-2", "point": { "x": 1.2, "y": 1.7, "z": -4.3 } }`
- `scoreboard_update`
  - payload: `{ players: [{ playerId, nickname, frags, deaths }] }`
- `match_ended`
  - payload: `{ winnerPlayerId, reason: "frag_limit" | "time_limit", players: [{ playerId, nickname, frags, deaths }] }`
- `error`
  - payload: `{ code, message }`

## Tick rates

- Client `state_update`: target 20 Hz.
- Server `player_state_batch`: target 10-20 Hz.
- `scoreboard_update`: event-driven.
