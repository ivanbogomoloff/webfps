import type { World } from 'miniplex'
import * as THREE from 'three'
import {
  applyWeaponDefinition,
  createHealth,
  createNetworkIdentity,
  createNetworkTransform,
  createPlayerAnimation,
  createPlayerController,
  createPlayerStats,
  createAudioEmitterState,
  createWeaponState,
} from '../ecs/components'
import { clonePlayerVisualSetup, type PlayerVisualSetup } from '../game/playerModelPrep'
import { replaceWeaponVisual } from '../game/weaponVisualAttach'
import { resolveWeaponId } from '../game/supportedWeaponModels'
import type { IncomingMessage, PlayerRole, ScoreboardPlayer } from './protocol'
import type { GameTransport, LocalStateUpdate } from './GameTransport'

type AnyEntity = Record<string, any>

export type NetworkContextVisualOptions = {
  getPlayerVisualTemplate(modelId: string): PlayerVisualSetup | undefined
  getWeaponVisualTemplate(weaponId: string): THREE.Object3D | undefined
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

  getOrCreateRemoteEntity(
    world: World,
    scene: THREE.Scene,
    playerId: string,
    nickname: string,
    modelId: string,
    weaponId: string,
    role: PlayerRole,
  ): AnyEntity {
    const existing = this.playerEntityById.get(playerId)
    if (existing) {
      this.setEntityWeapon(existing, weaponId)
      return existing
    }

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
      networkIdentity: createNetworkIdentity(playerId, nickname, modelId, resolveWeaponId(weaponId), false, role),
      networkTransform: createNetworkTransform(),
      playerStats: createPlayerStats(),
      audioEmitterState: createAudioEmitterState(),
      weaponState: createWeaponState(weaponId),
      weaponVisualRoot: setup?.visualModel ?? remoteRoot,
      weaponVisualObject: null,
      weaponVisualWeaponId: '',
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
          run_forward: setup.runForwardClip,
          run_backward: setup.runBackwardClip,
          run_left: setup.runLeftClip,
          run_right: setup.runRightClip,
          run_left_d: setup.runLeftDClip,
          run_right_d: setup.runRightDClip,
          run_backward_left_d: setup.runBackwardLeftDClip,
          run_backward_right_d: setup.runBackwardRightDClip,
          fire: setup.fireClip,
          walk_fire: setup.walkFireClip,
          walk_left_d_fire: setup.walkLeftDFireClip,
          walk_right_d_fire: setup.walkRightDFireClip,
          backwards_fire: setup.backwardsFireClip,
          backwards_left_d_fire: setup.backwardsLeftDFireClip,
          backwards_right_d_fire: setup.backwardsRightDFireClip,
          left_fire: setup.leftFireClip,
          right_fire: setup.rightFireClip,
          idle_crouch_fire: setup.idleCrouchFireClip,
          walk_crouch_fire: setup.walkCrouchFireClip,
          walk_crouch_left_d_fire: setup.walkCrouchLeftDFireClip,
          walk_crouch_right_d_fire: setup.walkCrouchRightDFireClip,
          backwards_crouch_fire: setup.backwardsCrouchFireClip,
          backwards_crouch_left_d_fire: setup.backwardsCrouchLeftDFireClip,
          backwards_crouch_right_d_fire: setup.backwardsCrouchRightDFireClip,
          left_crouch_fire: setup.leftCrouchFireClip,
          right_crouch_fire: setup.rightCrouchFireClip,
          run_forward_fire: setup.runForwardFireClip,
          run_backward_fire: setup.runBackwardFireClip,
          run_left_fire: setup.runLeftFireClip,
          run_right_fire: setup.runRightFireClip,
          run_left_d_fire: setup.runLeftDFireClip,
          run_right_d_fire: setup.runRightDFireClip,
          run_backward_left_d_fire: setup.runBackwardLeftDFireClip,
          run_backward_right_d_fire: setup.runBackwardRightDFireClip,
          jump_up: setup.jumpUpClip,
        }),
      )
    }

    world.add(entity)
    this.setEntityWeapon(entity, weaponId)
    this.playerEntityById.set(playerId, entity)
    return entity
  }

  setEntityWeapon(entity: AnyEntity, weaponId: string): void {
    if (!entity.weaponState) {
      entity.weaponState = createWeaponState(weaponId)
    } else {
      applyWeaponDefinition(entity.weaponState, weaponId)
    }
    if (entity.networkIdentity) {
      entity.networkIdentity.weaponId = entity.weaponState.weaponId
    }
    const template = this.visualOptions?.getWeaponVisualTemplate(entity.weaponState.weaponId)
    const visualRoot = (entity.weaponVisualRoot as THREE.Object3D | undefined) ?? entity.object3d
    if (entity.weaponVisualWeaponId === entity.weaponState.weaponId && entity.weaponVisualObject) {
      return
    }
    entity.weaponVisualObject = replaceWeaponVisual(
      visualRoot,
      entity.weaponVisualObject as THREE.Object3D | null | undefined,
      template,
    )
    entity.weaponVisualWeaponId = entity.weaponState.weaponId
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
