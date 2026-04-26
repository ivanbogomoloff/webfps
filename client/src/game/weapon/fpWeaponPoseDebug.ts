import type { WeaponAnimationPoseKey, WeaponTransformValues } from '../../config/weapons/types'
import { cloneWeaponTransformValues } from '../../config/weapons/types'

const overridesByWeaponId = new Map<string, Partial<Record<WeaponAnimationPoseKey, WeaponTransformValues>>>()
const versionByWeaponAndPose = new Map<string, number>()

function poseVersionKey(weaponId: string, poseKey: WeaponAnimationPoseKey): string {
  return `${weaponId}:${poseKey}`
}

export function getFpWeaponPoseOverride(
  weaponId: string,
  poseKey: WeaponAnimationPoseKey,
): WeaponTransformValues | null {
  const byPose = overridesByWeaponId.get(weaponId)
  const values = byPose?.[poseKey]
  return values ? cloneWeaponTransformValues(values) : null
}

export function setFpWeaponPoseOverride(
  weaponId: string,
  poseKey: WeaponAnimationPoseKey,
  values: WeaponTransformValues,
): void {
  const byPose = overridesByWeaponId.get(weaponId) ?? {}
  byPose[poseKey] = cloneWeaponTransformValues(values)
  overridesByWeaponId.set(weaponId, byPose)
  const versionKey = poseVersionKey(weaponId, poseKey)
  versionByWeaponAndPose.set(versionKey, (versionByWeaponAndPose.get(versionKey) ?? 0) + 1)
}

export function getFpWeaponPoseOverrideVersion(
  weaponId: string,
  poseKey: WeaponAnimationPoseKey,
): number {
  return versionByWeaponAndPose.get(poseVersionKey(weaponId, poseKey)) ?? 0
}
