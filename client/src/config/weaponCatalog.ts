import type { PlayerLocomotion } from '../ecs/components/PlayerController'
import { pistolModelConfig } from './weapons/pistol'
import { rifleModelConfig } from './weapons/rifle'
import type { WeaponModelConfig, WeaponTransformValues } from './weapons/types'

export type WeaponDefinition = {
  fireRate: number
  damage: number
  magazineSize: number
}

export const WEAPON_CATALOG = {
  pistol: {
    fireRate: 3,
    damage: 20,
    magazineSize: 12,
  },
  rifle: {
    fireRate: 8,
    damage: 12,
    magazineSize: 30,
  },
} as const satisfies Record<string, WeaponDefinition>

export type WeaponId = keyof typeof WEAPON_CATALOG

export const SUPPORTED_WEAPON_IDS = Object.keys(WEAPON_CATALOG) as WeaponId[]

export const DEFAULT_WEAPON_ID: WeaponId = 'pistol'

const WEAPON_MODEL_CONFIG_BY_ID = {
  pistol: pistolModelConfig,
  rifle: rifleModelConfig,
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
  return {
    weaponId,
    ...WEAPON_CATALOG[weaponId],
  }
}

export function getWeaponModelConfig(rawWeaponId: string): WeaponModelConfig & { weaponId: WeaponId } {
  const weaponId = resolveWeaponId(rawWeaponId)
  return {
    weaponId,
    ...WEAPON_MODEL_CONFIG_BY_ID[weaponId],
  }
}

export function getWeaponPoseForLocomotion(
  rawWeaponId: string,
  locomotion: PlayerLocomotion,
): WeaponTransformValues {
  return getWeaponModelConfig(rawWeaponId).placementByLocomotion[locomotion]
}
