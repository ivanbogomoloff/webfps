import type { PlayerLocomotion } from '../ecs/components/PlayerController'

export type PlayerRole = 'spectator' | 'player'
export type MatchPhase = 'waiting' | 'running' | 'ended'

export interface JoinRoomPayload {
  roomCode: string
  nickname: string
  modelId: string
  weaponId: string
  mapId: string
  timeLimitSec: number
  fragLimit: number
}

export interface PlayerStateMessage {
  playerId: string
  /** Совпадает с `room_state` / `player_joined`; нужен, если батч приходит раньше полного room_state. */
  modelId: string
  weaponId: string
  /** Локомоция с отправителя state_update (если нет в JSON — на клиенте считается idle). */
  locomotion?: PlayerLocomotion
  x: number
  y: number
  z: number
  rotY: number
  role: PlayerRole
  frags: number
  deaths: number
}

export interface ScoreboardPlayer {
  playerId: string
  nickname: string
  frags: number
  deaths: number
}

export interface RoomPlayer {
  playerId: string
  nickname: string
  modelId: string
  weaponId: string
  role: PlayerRole
  frags: number
  deaths: number
}

export type IncomingMessage =
  | {
      type: 'room_joined'
      payload: { roomCode: string; localPlayerId: string; mapId: string; maxPlayers: number }
    }
  | {
      type: 'room_state'
      payload: {
        phase: MatchPhase
        timeLimitSec: number
        timeLeftSec: number
        fragLimit: number
        players: RoomPlayer[]
      }
    }
  | {
      type: 'player_joined'
      payload: { playerId: string; nickname: string; modelId: string; weaponId: string; role: PlayerRole }
    }
  | { type: 'player_left'; payload: { playerId: string } }
  | { type: 'match_started'; payload: { startedAtUnixMs: number; timeLimitSec: number; fragLimit: number } }
  | { type: 'match_tick'; payload: { timeLeftSec: number } }
  | { type: 'player_state_batch'; payload: { states: PlayerStateMessage[] } }
  | { type: 'scoreboard_update'; payload: { players: ScoreboardPlayer[] } }
  | { type: 'match_ended'; payload: { winnerPlayerId: string; reason: 'frag_limit' | 'time_limit'; players: ScoreboardPlayer[] } }
  | { type: 'error'; payload: { code: string; message: string } }

export type OutgoingMessage =
  | { type: 'join_room'; payload: JoinRoomPayload }
  | { type: 'set_role'; payload: { role: PlayerRole } }
  | { type: 'spawn_request'; payload: Record<string, never> }
  | {
      type: 'state_update'
      payload: {
        x: number
        y: number
        z: number
        rotY: number
        role: PlayerRole
        frags: number
        deaths: number
        locomotion: PlayerLocomotion
        weaponId: string
      }
    }
  | { type: 'report_kill'; payload: { victimPlayerId: string } }
  | { type: 'leave_room'; payload: Record<string, never> }
