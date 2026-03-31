import type { World } from 'miniplex'
import * as THREE from 'three'
import {
  createHealth,
  createNetworkIdentity,
  createNetworkTransform,
  createPlayerAnimation,
  createPlayerController,
  createPlayerStats,
} from '../ecs/components'
import { clonePlayerVisualSetup, type PlayerVisualSetup } from '../game/playerModelPrep'
import type { IncomingMessage, PlayerRole, ScoreboardPlayer } from './protocol'
import type { GameTransport, LocalStateUpdate } from './GameTransport'

type AnyEntity = Record<string, any>

export type NetworkContextVisualOptions = {
  getPlayerVisualTemplate(modelId: string): PlayerVisualSetup | undefined
}

export class NetworkContext {
  private queue: IncomingMessage[] = []
  private unsub: (() => void) | null = null
  private playerEntityById = new Map<string, AnyEntity>()
  private localPlayerEntity: AnyEntity | null = null
  private localPlayerId: string | null = null

  public scoreboard: ScoreboardPlayer[] = []
  public lastError: string | null = null

  constructor(
    private readonly transport: GameTransport,
    private readonly visualOptions?: NetworkContextVisualOptions,
  ) {}

  start(): void {
    this.unsub = this.transport.subscribe((message) => {
      this.queue.push(message)
    })
  }

  stop(): void {
    if (this.unsub) this.unsub()
    this.unsub = null
    this.queue = []
  }

  setLocalPlayerEntity(entity: AnyEntity): void {
    this.localPlayerEntity = entity
  }

  getLocalPlayerEntity(): AnyEntity | null {
    return this.localPlayerEntity
  }

  consumeQueue(): IncomingMessage[] {
    const current = this.queue
    this.queue = []
    return current
  }

  getOrCreateRemoteEntity(world: World, scene: THREE.Scene, playerId: string, nickname: string, modelId: string, role: PlayerRole): AnyEntity {
    const existing = this.playerEntityById.get(playerId)
    if (existing) return existing

    const remoteRoot = new THREE.Group()
    const template = this.visualOptions?.getPlayerVisualTemplate(modelId)
    const setup = template?.idleClip && template?.walkClip ? clonePlayerVisualSetup(template) : null

    if (setup) {
      remoteRoot.add(setup.visualModel)
    } else {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.1, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0x4fa3ff }),
      )
      mesh.castShadow = true
      remoteRoot.add(mesh)
    }
    scene.add(remoteRoot)

    const entity: AnyEntity = {
      id: Math.random(),
      object3d: remoteRoot,
      health: createHealth(100),
      networkIdentity: createNetworkIdentity(playerId, nickname, modelId, false, role),
      networkTransform: createNetworkTransform(),
      playerStats: createPlayerStats(),
    }

    if (setup) {
      entity.playerController = createPlayerController(5, 0)
      world.addComponent(
        entity as any,
        'playerAnimation',
        createPlayerAnimation(setup.visualModel, {
          idle: setup.idleClip!,
          walk: setup.walkClip!,
          walk_left_d: setup.walkLeftDClip,
          walk_right_d: setup.walkRightDClip,
          backwards: setup.backwardsClip,
          backwards_left_d: setup.backwardsLeftDClip,
          backwards_right_d: setup.backwardsRightDClip,
          left: setup.left,
          right: setup.right,
          idle_crouch: setup.idleCrouchClip,
          walk_crouch: setup.walkCrouchClip,
          walk_crouch_left_d: setup.walkCrouchLeftDClip,
          walk_crouch_right_d: setup.walkCrouchRightDClip,
          backwards_crouch: setup.backwardsCrouchClip,
          backwards_crouch_left_d: setup.backwardsCrouchLeftDClip,
          backwards_crouch_right_d: setup.backwardsCrouchRightDClip,
          left_crouch: setup.leftCrouchClip,
          right_crouch: setup.rightCrouchClip,
          jump_up: setup.jumpUpClip,
        }),
      )
    }

    world.add(entity)
    this.playerEntityById.set(playerId, entity)
    return entity
  }

  registerPlayerEntity(playerId: string, entity: AnyEntity): void {
    this.playerEntityById.set(playerId, entity)
  }

  getPlayerEntity(playerId: string): AnyEntity | undefined {
    return this.playerEntityById.get(playerId)
  }

  removePlayerEntity(world: World, scene: THREE.Scene, playerId: string): void {
    const entity = this.playerEntityById.get(playerId)
    if (!entity) return
    if (entity.object3d) {
      scene.remove(entity.object3d)
    }
    world.remove(entity as any)
    this.playerEntityById.delete(playerId)
  }

  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId ?? this.transport.getLocalPlayerId()
  }

  sendState(update: LocalStateUpdate): void {
    this.transport.sendState(update)
  }

  setRole(role: PlayerRole): void {
    this.transport.setRole(role)
  }

  requestSpawn(): void {
    this.transport.requestSpawn()
  }

  reportKill(victimPlayerId: string): void {
    this.transport.reportKill(victimPlayerId)
  }
}
