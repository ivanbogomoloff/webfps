import type { IncomingMessage, JoinRoomPayload, PlayerRole } from './protocol'
import type { PlayerLocomotion } from '../ecs/components/PlayerController'

export interface TransportConnectParams extends JoinRoomPayload {}

export interface LocalStateUpdate {
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

export type TransportHandler = (message: IncomingMessage) => void

export interface GameTransport {
  connect(params: TransportConnectParams): Promise<void>
  disconnect(): Promise<void>
  setRole(role: PlayerRole): void
  requestSpawn(): void
  addBot(): void
  debugHitSelf(): void
  sendState(update: LocalStateUpdate): void
  reportKill(victimPlayerId: string): void
  subscribe(handler: TransportHandler): () => void
  getLocalPlayerId(): string | null
  /** Код комнаты после join (сервер присылает в room_joined; offline — сразу после connect). */
  getRoomCode(): string | null
}
