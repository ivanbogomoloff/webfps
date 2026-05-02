import type { World } from 'miniplex'
import * as THREE from 'three'
import {
  getWeaponDefinition,
  SUPPORTED_WEAPON_IDS,
} from '../../game/weapon/supportedWeaponModels'
import { toBaseLocomotionFromFire } from '../../game/player/playerLocomotionLogic'
import type {
  AudioEmitterState,
  NetworkIdentity,
  PlayerController,
  PlayerLocomotion,
  PlayerPhysicsState,
  WeaponState,
} from '../components'

type AudioEntity = {
  object3d: THREE.Object3D
  playerController: PlayerController
  audioEmitterState: AudioEmitterState
  weaponState: WeaponState
  networkIdentity?: NetworkIdentity
  playerPhysicsState?: PlayerPhysicsState
}

type ClipConfig = {
  src: string
  volume: number
  refDistance: number
  maxDistance: number
}

type AudioNodes = {
  footstep: THREE.PositionalAudio
  jump: THREE.PositionalAudio
  shot: THREE.PositionalAudio
}

type LoadedClip =
  | { status: 'loading'; promise: Promise<AudioBuffer> }
  | { status: 'ready'; buffer: AudioBuffer }
  | { status: 'error' }

const PLAYER_CLIPS = {
  footstepWalk: {
    src: '/audio/player/footstep_walk.ogg',
    volume: 0.38,
    refDistance: 8,
    maxDistance: 42,
  } as const satisfies ClipConfig,
  footstepRun: {
    src: '/audio/player/footstep_run.ogg',
    volume: 0.48,
    refDistance: 10,
    maxDistance: 50,
  } as const satisfies ClipConfig,
  jump: {
    src: '/audio/player/jump.ogg',
    volume: 0.34,
    refDistance: 9,
    maxDistance: 44,
  } as const satisfies ClipConfig,
  land: {
    src: '/audio/player/land.wav',
    volume: 0.36,
    refDistance: 9,
    maxDistance: 44,
  } as const satisfies ClipConfig,
}

function isFireLocomotion(locomotion: PlayerLocomotion): boolean {
  return locomotion === 'fire' || locomotion.includes('_fire')
}

function isJumpLocomotion(locomotion: PlayerLocomotion): boolean {
  return locomotion === 'jump_up'
}

function isMovingBaseLocomotion(locomotion: PlayerLocomotion): boolean {
  switch (locomotion) {
    case 'walk':
    case 'walk_left_d':
    case 'walk_right_d':
    case 'backwards':
    case 'backwards_left_d':
    case 'backwards_right_d':
    case 'left':
    case 'right':
    case 'walk_crouch':
    case 'walk_crouch_left_d':
    case 'walk_crouch_right_d':
    case 'backwards_crouch':
    case 'backwards_crouch_left_d':
    case 'backwards_crouch_right_d':
    case 'left_crouch':
    case 'right_crouch':
    case 'run_forward':
    case 'run_backward':
    case 'run_left':
    case 'run_right':
    case 'run_left_d':
    case 'run_right_d':
    case 'run_backward_left_d':
    case 'run_backward_right_d':
      return true
    default:
      return false
  }
}

function getFootstepIntervalSec(baseLocomotion: PlayerLocomotion): number {
  if (baseLocomotion.startsWith('run_')) return 0.28
  if (baseLocomotion.includes('crouch')) return 0.52
  return 0.4
}

function createPositionalNode(
  listener: THREE.AudioListener,
  owner: THREE.Object3D,
): THREE.PositionalAudio {
  const node = new THREE.PositionalAudio(listener)
  node.setDistanceModel('exponential')
  node.setRolloffFactor(1.4)
  owner.add(node)
  return node
}

export function createAudioSystem(world: World, camera: THREE.PerspectiveCamera) {
  const listener = new THREE.AudioListener()
  camera.add(listener)

  const loader = new THREE.AudioLoader()
  const clipCache = new Map<string, LoadedClip>()
  const nodesByEntity = new WeakMap<object, AudioNodes>()

  const preload = new Set<string>([
    PLAYER_CLIPS.footstepWalk.src,
    PLAYER_CLIPS.footstepRun.src,
    PLAYER_CLIPS.jump.src,
    PLAYER_CLIPS.land.src,
  ])
  for (const weaponId of SUPPORTED_WEAPON_IDS) {
    const weaponAudio = getWeaponDefinition(weaponId).audio
    for (const clip of Object.values(weaponAudio)) {
      if (!clip?.src) continue
      preload.add(clip.src)
    }
  }

  const loadClip = (src: string): void => {
    if (clipCache.has(src)) return
    const promise = loader.loadAsync(src)
    clipCache.set(src, { status: 'loading', promise })
    void promise
      .then((buffer) => {
        clipCache.set(src, { status: 'ready', buffer })
      })
      .catch(() => {
        clipCache.set(src, { status: 'error' })
      })
  }

  const getBuffer = (src: string): AudioBuffer | null => {
    const loaded = clipCache.get(src)
    if (!loaded) {
      loadClip(src)
      return null
    }
    if (loaded.status === 'ready') {
      return loaded.buffer
    }
    return null
  }

  const getNodes = (entity: AudioEntity): AudioNodes => {
    const cached = nodesByEntity.get(entity)
    if (cached) return cached
    const nodes: AudioNodes = {
      footstep: createPositionalNode(listener, entity.object3d),
      jump: createPositionalNode(listener, entity.object3d),
      shot: createPositionalNode(listener, entity.object3d),
    }
    nodesByEntity.set(entity, nodes)
    return nodes
  }

  const playClip = (node: THREE.PositionalAudio, clip: ClipConfig): void => {
    const buffer = getBuffer(clip.src)
    if (!buffer) return
    if (node.isPlaying) {
      node.stop()
    }
    node.setBuffer(buffer)
    node.setRefDistance(clip.refDistance)
    node.setMaxDistance(clip.maxDistance)
    node.setVolume(clip.volume)
    node.play()
  }

  for (const src of preload) {
    loadClip(src)
  }

  return (deltaTime: number) => {
    for (const entity of world.with('object3d', 'playerController', 'audioEmitterState', 'weaponState')) {
      const audioEntity = entity as AudioEntity
      const state = audioEntity.audioEmitterState
      const locomotion = audioEntity.playerController.locomotion
      const baseLocomotion = toBaseLocomotionFromFire(locomotion)
      const fireActive = isFireLocomotion(locomotion) || audioEntity.weaponState.action === 'fire'
      const isReloading = audioEntity.weaponState.isReloading
      const isLocal = !!audioEntity.networkIdentity?.isLocal
      const grounded = isLocal
        ? !!audioEntity.playerPhysicsState?.isGrounded
        : !isJumpLocomotion(locomotion)

      const nodes = getNodes(audioEntity)

      state.fireCooldownSec = Math.max(0, state.fireCooldownSec - deltaTime)
      state.emptyShotCooldownSec = Math.max(0, state.emptyShotCooldownSec - deltaTime)
      if (fireActive && (!state.wasFireActive || state.fireCooldownSec <= 0)) {
        const shotConfig = getWeaponDefinition(audioEntity.weaponState.weaponId).audio.shot
        if (!shotConfig?.src) {
          state.fireCooldownSec = Math.max(0.06, 1 / Math.max(1, audioEntity.weaponState.fireRate))
          state.wasFireActive = fireActive
          state.wasReloading = isReloading
          state.wasGrounded = grounded
          state.lastLocomotion = locomotion
          continue
        }
        playClip(nodes.shot, {
          src: shotConfig.src,
          volume: shotConfig.volume ?? 0.72,
          refDistance: shotConfig.refDistance ?? 10,
          maxDistance: shotConfig.maxDistance ?? 58,
        })
        state.fireCooldownSec = Math.max(0.06, 1 / Math.max(1, audioEntity.weaponState.fireRate))
      }
      if (isLocal && audioEntity.weaponState.emptyShotCounter > state.lastEmptyShotCounter) {
        const emptyShotConfig = getWeaponDefinition(audioEntity.weaponState.weaponId).audio.emptyShot
        if (emptyShotConfig?.src && state.emptyShotCooldownSec <= 0) {
          playClip(nodes.shot, {
            src: emptyShotConfig.src,
            volume: emptyShotConfig.volume ?? 0.7,
            refDistance: emptyShotConfig.refDistance ?? 8,
            maxDistance: emptyShotConfig.maxDistance ?? 42,
          })
          state.emptyShotCooldownSec = 0.12
        }
      }
      if (isLocal && isReloading && !state.wasReloading) {
        const reloadConfig = getWeaponDefinition(audioEntity.weaponState.weaponId).audio.reload
        if (reloadConfig?.src) {
          playClip(nodes.shot, {
            src: reloadConfig.src,
            volume: reloadConfig.volume ?? 0.68,
            refDistance: reloadConfig.refDistance ?? 10,
            maxDistance: reloadConfig.maxDistance ?? 58,
          })
        }
      }
      state.lastEmptyShotCounter = audioEntity.weaponState.emptyShotCounter

      if (!state.wasGrounded && grounded) {
        playClip(nodes.jump, PLAYER_CLIPS.land)
      } else if (state.wasGrounded && !grounded && isJumpLocomotion(locomotion)) {
        playClip(nodes.jump, PLAYER_CLIPS.jump)
      }

      const movingOnGround = grounded && isMovingBaseLocomotion(baseLocomotion)
      if (!movingOnGround) {
        state.footstepTimerSec = 0
      } else {
        state.footstepTimerSec -= deltaTime
        if (state.footstepTimerSec <= 0) {
          const clip = baseLocomotion.startsWith('run_')
            ? PLAYER_CLIPS.footstepRun
            : PLAYER_CLIPS.footstepWalk
          playClip(nodes.footstep, clip)
          state.footstepTimerSec = getFootstepIntervalSec(baseLocomotion)
        }
      }

      state.wasFireActive = fireActive
      state.wasReloading = isReloading
      state.wasGrounded = grounded
      state.lastLocomotion = locomotion
    }
  }
}
