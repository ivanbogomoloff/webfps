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
  - payload: `{ "roomCode": "1234", "nickname": "ivan", "modelId": "player1", "mapId": "test2", "timeLimitSec": 600, "fragLimit": 25 }`
- `set_role`
  - payload: `{ "role": "spectator" | "player" }`
- `spawn_request`
  - payload: `{}`
- `state_update`
  - payload: `{ "x": 0, "y": 0, "z": 0, "rotY": 0, "role": "spectator" | "player", "frags": 0, "deaths": 0, "locomotion": "idle" | "walk" | "walk_left_d" | "walk_right_d" | "backwards" | "backwards_left_d" | "backwards_right_d" | "left" | "right" | "jump_up" }`
- `report_kill`
  - payload: `{ "victimPlayerId": "p-2" }`
- `leave_room`
  - payload: `{}`

## Server -> Client

- `room_joined`
  - payload: `{ "roomCode": "1234", "localPlayerId": "p-1", "mapId": "test2", "maxPlayers": 4 }`
- `room_state`
  - payload:
    - `phase`: `"waiting" | "running" | "ended"`
    - `timeLimitSec`, `timeLeftSec`, `fragLimit`
    - `players`: array with `{ playerId, nickname, modelId, role, frags, deaths }`
- `player_joined`
  - payload: `{ playerId, nickname, modelId, role }`
- `player_left`
  - payload: `{ playerId }`
- `match_started`
  - payload: `{ startedAtUnixMs, timeLimitSec, fragLimit }`
- `match_tick`
  - payload: `{ timeLeftSec }`
- `player_state_batch`
  - payload: `{ states: [{ playerId, modelId, locomotion, x, y, z, rotY, role, frags, deaths }] }`
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
