import type { GameTransport, LocalStateUpdate, TransportConnectParams, TransportHandler } from './GameTransport'
import type { IncomingMessage, OutgoingMessage, PlayerRole } from './protocol'

export class WsTransport implements GameTransport {
  private socket: WebSocket | null = null
  private handlers = new Set<TransportHandler>()
  private localPlayerId: string | null = null
  private roomCode: string | null = null

  constructor(private readonly wsUrl: string) {}

  async connect(params: TransportConnectParams): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return

    const socket = new WebSocket(this.wsUrl)
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener('error', onError)
        resolve()
      }
      const onError = () => {
        socket.removeEventListener('open', onOpen)
        reject(new Error('WebSocket connection failed'))
      }
      socket.addEventListener('open', onOpen, { once: true })
      socket.addEventListener('error', onError, { once: true })
    })

    socket.addEventListener('message', (event) => {
      const data = this.safeParse(event.data)
      if (!data) return
      if (data.type === 'room_joined') {
        this.localPlayerId = data.payload.localPlayerId
        this.roomCode = data.payload.roomCode
      }
      this.emit(data)
    })

    this.send({ type: 'join_room', payload: params })
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return
    this.send({ type: 'leave_room', payload: {} })
    this.socket.close()
    this.socket = null
    this.roomCode = null
    this.localPlayerId = null
  }

  setRole(role: PlayerRole): void {
    this.send({ type: 'set_role', payload: { role } })
  }

  requestSpawn(): void {
    this.send({ type: 'spawn_request', payload: {} })
  }

  debugHitSelf(): void {
    this.send({ type: 'debug_hit_self', payload: {} })
  }

  sendState(update: LocalStateUpdate): void {
    this.send({
      type: 'state_update',
      payload: {
        x: update.x,
        y: update.y,
        z: update.z,
        rotY: update.rotY,
        role: update.role,
        frags: update.frags,
        deaths: update.deaths,
        locomotion: update.locomotion,
        weaponId: update.weaponId,
      },
    })
  }

  reportKill(victimPlayerId: string): void {
    this.send({ type: 'report_kill', payload: { victimPlayerId } })
  }

  subscribe(handler: TransportHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId
  }

  getRoomCode(): string | null {
    return this.roomCode
  }

  private emit(message: IncomingMessage): void {
    for (const handler of this.handlers) {
      handler(message)
    }
  }

  private send(message: OutgoingMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
    this.socket.send(JSON.stringify(message))
  }

  private safeParse(raw: unknown): IncomingMessage | null {
    if (typeof raw !== 'string') return null
    try {
      return JSON.parse(raw) as IncomingMessage
    } catch (error) {
      console.warn('[ws] failed to parse message', error)
      return null
    }
  }
}
