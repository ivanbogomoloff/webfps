import type { PlayerLocomotion } from '../../ecs/components/PlayerController'

export const PLAYER_LOCOMOTION_KEYS: readonly PlayerLocomotion[] = [
  'idle',
  'walk',
  'walk_left_d',
  'walk_right_d',
  'backwards',
  'backwards_left_d',
  'backwards_right_d',
  'left',
  'right',
  'idle_crouch',
  'walk_crouch',
  'walk_crouch_left_d',
  'walk_crouch_right_d',
  'backwards_crouch',
  'backwards_crouch_left_d',
  'backwards_crouch_right_d',
  'left_crouch',
  'right_crouch',
  'run_forward',
  'run_backward',
  'run_left',
  'run_right',
  'run_left_d',
  'run_right_d',
  'run_backward_left_d',
  'run_backward_right_d',
  'jump_up',
  'fire',
  'walk_fire',
  'walk_left_d_fire',
  'walk_right_d_fire',
  'backwards_fire',
  'backwards_left_d_fire',
  'backwards_right_d_fire',
  'left_fire',
  'right_fire',
  'idle_crouch_fire',
  'walk_crouch_fire',
  'walk_crouch_left_d_fire',
  'walk_crouch_right_d_fire',
  'backwards_crouch_fire',
  'backwards_crouch_left_d_fire',
  'backwards_crouch_right_d_fire',
  'left_crouch_fire',
  'right_crouch_fire',
  'run_forward_fire',
  'run_backward_fire',
  'run_left_fire',
  'run_right_fire',
  'run_left_d_fire',
  'run_right_d_fire',
  'run_backward_left_d_fire',
  'run_backward_right_d_fire',
  'death_back',
  'death_crouch',
]

export type WeaponTransformValues = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

export type WeaponPoseByLocomotion = Record<PlayerLocomotion, WeaponTransformValues>
export type WeaponAnimationPoseKey = 'idle' | 'walk' | 'run' | 'fire' | 'reload' | 'pick'
export type WeaponFpPoseByAnimation = Record<WeaponAnimationPoseKey, WeaponTransformValues>
export type WeaponAudioEvent = 'shot' | 'reload' | 'emptyShot' | (string & {})

export type WeaponAudioClipConfig = {
  src: string
  volume?: number
  refDistance?: number
  maxDistance?: number
}

export type WeaponAudioConfig = {
  shot: WeaponAudioClipConfig
} & Partial<Record<WeaponAudioEvent, WeaponAudioClipConfig>>

export type WeaponCrosshairConfig = {
  color: string
  gapPx: number
  armLengthPx: number
  armThicknessPx: number
  baseScale: number
  shotPulseScale: number
  pulseDecayPerSec: number
}

export const WEAPON_ANIMATION_POSE_KEYS: readonly WeaponAnimationPoseKey[] = [
  'idle',
  'walk',
  'run',
  'fire',
  'reload',
  'pick',
]

export type WeaponModelConfig = {
  id: string
  magazineSize: number
  reloadTimeSec: number
  pickTimeSec: number
  placementByLocomotion: WeaponPoseByLocomotion
  fpPlacementByAnimation: WeaponFpPoseByAnimation
  audio: WeaponAudioConfig
  crosshair: WeaponCrosshairConfig
}

export function cloneWeaponTransformValues(values: WeaponTransformValues): WeaponTransformValues {
  return {
    position: { ...values.position },
    rotation: { ...values.rotation },
    scale: { ...values.scale },
  }
}

export function cloneWeaponPoseByLocomotion(
  placementByLocomotion: WeaponPoseByLocomotion,
): WeaponPoseByLocomotion {
  return Object.fromEntries(
    PLAYER_LOCOMOTION_KEYS.map((locomotion) => [
      locomotion,
      cloneWeaponTransformValues(placementByLocomotion[locomotion]),
    ]),
  ) as WeaponPoseByLocomotion
}

export function cloneWeaponFpPoseByAnimation(
  fpPlacementByAnimation: WeaponFpPoseByAnimation,
): WeaponFpPoseByAnimation {
  return Object.fromEntries(
    WEAPON_ANIMATION_POSE_KEYS.map((poseKey) => [
      poseKey,
      cloneWeaponTransformValues(fpPlacementByAnimation[poseKey]),
    ]),
  ) as WeaponFpPoseByAnimation
}

export function createUniformWeaponPlacement(
  transform: WeaponTransformValues,
): WeaponPoseByLocomotion {
  return Object.fromEntries(
    PLAYER_LOCOMOTION_KEYS.map((locomotion) => [locomotion, cloneWeaponTransformValues(transform)]),
  ) as WeaponPoseByLocomotion
}

export function createUniformFpWeaponPlacement(
  transform: WeaponTransformValues,
): WeaponFpPoseByAnimation {
  return Object.fromEntries(
    WEAPON_ANIMATION_POSE_KEYS.map((poseKey) => [poseKey, cloneWeaponTransformValues(transform)]),
  ) as WeaponFpPoseByAnimation
}

export function resolveWeaponAnimationPoseKey(
  locomotion: PlayerLocomotion,
  weaponAction: string,
): WeaponAnimationPoseKey {
  if (weaponAction === 'reload') return 'reload'
  if (weaponAction === 'pick') return 'pick'
  if (weaponAction === 'fire' || locomotion.includes('fire')) return 'fire'
  if (weaponAction === 'run' || locomotion.startsWith('run_')) return 'run'
  if (locomotion === 'idle' || locomotion === 'idle_crouch' || locomotion.startsWith('death_')) {
    return 'idle'
  }
  return 'walk'
}
