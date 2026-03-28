import { getSpawnCountByMap } from '../config/mapManifest'
import { pickRandomBotModelId } from '../game/supportedPlayerModels'
import type { GameTransport, LocalStateUpdate, TransportConnectParams, TransportHandler } from './GameTransport'
import type { IncomingMessage, MatchPhase, PlayerRole, ScoreboardPlayer } from './protocol'

type SimPlayer = {
  playerId: string
  nickname: string
  modelId: string
  role: PlayerRole
  x: number
  y: number
  z: number
  rotY: number
  frags: number
  deaths: number
}

export class OfflineLoopbackTransport implements GameTransport {
  private handlers = new Set<TransportHandler>()
  private localPlayerId: string | null = null
  private roomCode = '0000'
  private mapId = 'test2'
  private maxPlayers = 4
  private phase: MatchPhase = 'waiting'
  private timeLimitSec = 600
  private fragLimit = 25
  private timeLeftSec = 600
  private intervalId: number | null = null
  private tickAccumulator = 0
  private players = new Map<string, SimPlayer>()
  private botAngle = 0
  private readonly botId = 'bot-1'

  async connect(params: TransportConnectParams): Promise<void> {
    this.roomCode = params.roomCode || this.roomCode
    this.mapId = params.mapId || this.mapId
    this.maxPlayers = getSpawnCountByMap(this.mapId)
    this.timeLimitSec = Math.max(30, params.timeLimitSec || 600)
    this.fragLimit = Math.max(1, params.fragLimit || 25)
    this.timeLeftSec = this.timeLimitSec

    this.localPlayerId = 'local-1'
    this.players.clear()
    this.players.set(this.localPlayerId, {
      playerId: this.localPlayerId,
      nickname: params.nickname || 'Player',
      modelId: params.modelId || 'player1',
      role: 'spectator',
      x: 0,
      y: 1,
      z: 0,
      rotY: 0,
      frags: 0,
      deaths: 0,
    })
    this.players.set(this.botId, {
      playerId: this.botId,
      nickname: 'Bot',
      modelId: pickRandomBotModelId(),
      role: 'player',
      x: 4,
      y: 1,
      z: 0,
      rotY: 0,
      frags: 0,
      deaths: 0,
    })

    this.emit({
      type: 'room_joined',
      payload: {
        roomCode: this.roomCode,
        localPlayerId: this.localPlayerId,
        mapId: this.mapId,
        maxPlayers: this.maxPlayers,
      },
    })
    this.emitRoomState()
    this.startLoop()
  }

  async disconnect(): Promise<void> {
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.players.clear()
  }

  setRole(role: PlayerRole): void {
    const local = this.getLocal()
    if (!local) return
    if (role === 'player') {
      const playerCount = Array.from(this.players.values()).filter((p) => p.role === 'player').length
      if (playerCount >= this.maxPlayers && local.role !== 'player') {
        this.emit({ type: 'error', payload: { code: 'room_full', message: 'No free player slot on this map' } })
        return
      }
    }
    local.role = role
    this.emitRoomState()
  }

  requestSpawn(): void {
    this.setRole('player')
    if (this.phase === 'waiting') {
      this.phase = 'running'
      this.timeLeftSec = this.timeLimitSec
      this.emit({
        type: 'match_started',
        payload: {
          startedAtUnixMs: Date.now(),
          timeLimitSec: this.timeLimitSec,
          fragLimit: this.fragLimit,
        },
      })
      this.emitRoomState()
    }
  }

  sendState(update: LocalStateUpdate): void {
    const local = this.getLocal()
    if (!local) return
    local.x = update.x
    local.y = update.y
    local.z = update.z
    local.rotY = update.rotY
    local.role = update.role
    local.frags = update.frags
    local.deaths = update.deaths
  }

  reportKill(victimPlayerId: string): void {
    const local = this.getLocal()
    const victim = this.players.get(victimPlayerId)
    if (!local || !victim || this.phase !== 'running') return
    local.frags += 1
    victim.deaths += 1
    this.emitScoreboard()
    this.checkMatchEnd('frag_limit')
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

  private startLoop(): void {
    if (this.intervalId != null) {
      window.clearInterval(this.intervalId)
    }
    this.intervalId = window.setInterval(() => {
      this.botStep(0.1)
      this.emitStateBatch()

      if (this.phase === 'running') {
        this.tickAccumulator += 0.1
        if (this.tickAccumulator >= 1) {
          this.tickAccumulator = 0
          this.timeLeftSec = Math.max(0, this.timeLeftSec - 1)
          this.emit({ type: 'match_tick', payload: { timeLeftSec: this.timeLeftSec } })
          this.checkMatchEnd('time_limit')
        }
      }
    }, 100)
  }

  private botStep(dt: number): void {
    const bot = this.players.get(this.botId)
    const local = this.getLocal()
    if (!bot || !local) return
    this.botAngle += dt * 0.8
    bot.x = Math.cos(this.botAngle) * 6
    bot.z = Math.sin(this.botAngle) * 6
    bot.rotY = this.botAngle

    if (this.phase === 'running' && Math.random() < 0.02) {
      bot.frags += 1
      local.deaths += 1
      this.emitScoreboard()
      this.checkMatchEnd('frag_limit')
    }
  }

  private checkMatchEnd(reason: 'frag_limit' | 'time_limit'): void {
    if (this.phase !== 'running') return
    const board = this.getScoreboard()
    const byFragLimit = board.find((p) => p.frags >= this.fragLimit)
    if (!byFragLimit && (reason !== 'time_limit' || this.timeLeftSec > 0)) return

    this.phase = 'ended'
    const winner = board[0]?.playerId ?? ''
    this.emit({
      type: 'match_ended',
      payload: {
        winnerPlayerId: winner,
        reason: byFragLimit ? 'frag_limit' : 'time_limit',
        players: board,
      },
    })
    this.emitRoomState()
  }

  private emitRoomState(): void {
    this.emit({
      type: 'room_state',
      payload: {
        phase: this.phase,
        timeLimitSec: this.timeLimitSec,
        timeLeftSec: this.timeLeftSec,
        fragLimit: this.fragLimit,
        players: Array.from(this.players.values()).map((player) => ({
          playerId: player.playerId,
          nickname: player.nickname,
          modelId: player.modelId,
          role: player.role,
          frags: player.frags,
          deaths: player.deaths,
        })),
      },
    })
    this.emitScoreboard()
  }

  private emitStateBatch(): void {
    this.emit({
      type: 'player_state_batch',
      payload: {
        states: Array.from(this.players.values()).map((player) => ({
          playerId: player.playerId,
          modelId: player.modelId,
          x: player.x,
          y: player.y,
          z: player.z,
          rotY: player.rotY,
          role: player.role,
          frags: player.frags,
          deaths: player.deaths,
        })),
      },
    })
  }

  private emitScoreboard(): void {
    this.emit({
      type: 'scoreboard_update',
      payload: {
        players: this.getScoreboard(),
      },
    })
  }

  private getScoreboard(): ScoreboardPlayer[] {
    return Array.from(this.players.values())
      .map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        frags: player.frags,
        deaths: player.deaths,
      }))
      .sort((a, b) => {
        if (b.frags !== a.frags) return b.frags - a.frags
        return a.deaths - b.deaths
      })
  }

  private getLocal(): SimPlayer | null {
    if (!this.localPlayerId) return null
    return this.players.get(this.localPlayerId) ?? null
  }

  private emit(message: IncomingMessage): void {
    for (const handler of this.handlers) {
      handler(message)
    }
  }
}
