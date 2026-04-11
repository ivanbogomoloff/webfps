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
]

export type WeaponTransformValues = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

export type WeaponPoseByLocomotion = Record<PlayerLocomotion, WeaponTransformValues>

export type WeaponModelConfig = {
  id: string
  placementByLocomotion: WeaponPoseByLocomotion
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

export function createUniformWeaponPlacement(
  transform: WeaponTransformValues,
): WeaponPoseByLocomotion {
  return Object.fromEntries(
    PLAYER_LOCOMOTION_KEYS.map((locomotion) => [locomotion, cloneWeaponTransformValues(transform)]),
  ) as WeaponPoseByLocomotion
}
