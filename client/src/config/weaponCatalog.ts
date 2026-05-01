import type { PlayerLocomotion } from '../ecs/components/PlayerController'
import { rifle_m16ModelConfig } from './weapons/rifle_m16'
import { rifle_ak47ModelConfig } from './weapons/rifle_ak47'
import type {
  WeaponAnimationPoseKey,
  WeaponAudioConfig,
  WeaponCrosshairConfig,
  WeaponFpPoseByAnimation,
  WeaponModelConfig,
  WeaponTransformValues,
} from './weapons/types'

export type WeaponDefinition = {
  fireRate: number
  damage: number
  magazineSize: number
  reloadTimeSec: number
  pickTimeSec: number
  audio: WeaponAudioConfig
  crosshair: WeaponCrosshairConfig
}

export const WEAPON_CATALOG = {
  rifle_m16: {
    fireRate: 3,
    damage: 20,
  },
  rifle_ak47: {
    fireRate: 8,
    damage: 12,
  },
} as const satisfies Record<string, Pick<WeaponDefinition, 'fireRate' | 'damage'>>

export type WeaponId = keyof typeof WEAPON_CATALOG

export const SUPPORTED_WEAPON_IDS = Object.keys(WEAPON_CATALOG) as WeaponId[]

export const DEFAULT_WEAPON_ID: WeaponId = 'rifle_m16'

const WEAPON_MODEL_CONFIG_BY_ID = {
  rifle_m16: rifle_m16ModelConfig,
  rifle_ak47: rifle_ak47ModelConfig,
} as const satisfies Record<WeaponId, WeaponModelConfig>

export function weaponModelGltfPath(weaponId: WeaponId): string {
  return `/models/weapons/${WEAPON_MODEL_CONFIG_BY_ID[weaponId].id}.glb`
}

export function resolveWeaponId(raw: string): WeaponId {
  const normalized = raw.trim().toLowerCase()
  return (SUPPORTED_WEAPON_IDS as readonly string[]).includes(normalized)
    ? (normalized as WeaponId)
    : DEFAULT_WEAPON_ID
}

export function getWeaponDefinition(rawWeaponId: string): WeaponDefinition & { weaponId: WeaponId } {
  const weaponId = resolveWeaponId(rawWeaponId)
  const weaponModelConfig = WEAPON_MODEL_CONFIG_BY_ID[weaponId]
  return {
    weaponId,
    ...WEAPON_CATALOG[weaponId],
    magazineSize: weaponModelConfig.magazineSize,
    reloadTimeSec: weaponModelConfig.reloadTimeSec,
    pickTimeSec: weaponModelConfig.pickTimeSec,
    audio: weaponModelConfig.audio,
    crosshair: weaponModelConfig.crosshair,
  }
}

export function getWeaponModelConfig(rawWeaponId: string): WeaponModelConfig & { weaponId: WeaponId } {
  const weaponId = resolveWeaponId(rawWeaponId)
  return {
    weaponId,
    ...WEAPON_MODEL_CONFIG_BY_ID[weaponId],
  }
}

export function getWeaponCrosshairConfig(
  rawWeaponId: string,
): WeaponCrosshairConfig & { weaponId: WeaponId } {
  const weaponConfig = getWeaponModelConfig(rawWeaponId)
  return {
    weaponId: weaponConfig.weaponId,
    ...weaponConfig.crosshair,
  }
}

export function getWeaponPoseForLocomotion(
  rawWeaponId: string,
  locomotion: PlayerLocomotion,
): WeaponTransformValues {
  return getWeaponModelConfig(rawWeaponId).placementByLocomotion[locomotion]
}

export function getWeaponFpPoseByAnimation(rawWeaponId: string): WeaponFpPoseByAnimation {
  return getWeaponModelConfig(rawWeaponId).fpPlacementByAnimation
}

export function getWeaponFpPoseForAnimation(
  rawWeaponId: string,
  poseKey: WeaponAnimationPoseKey,
): WeaponTransformValues {
  return getWeaponModelConfig(rawWeaponId).fpPlacementByAnimation[poseKey]
}
