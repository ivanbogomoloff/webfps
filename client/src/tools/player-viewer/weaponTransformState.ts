import type { PlayerLocomotion } from '../../ecs/components/PlayerController'
import type { WeaponTransformValues } from '../../config/weapons/types'

export function cloneWeaponTransformValues(values: WeaponTransformValues): WeaponTransformValues {
  return {
    position: { ...values.position },
    rotation: { ...values.rotation },
    scale: { ...values.scale },
  }
}

export function readWeaponTransformValuesFromObject(
  object: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } },
): WeaponTransformValues {
  return {
    position: { x: object.position.x, y: object.position.y, z: object.position.z },
    rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
    scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
  }
}

function formatNum(value: number): string {
  return Number(value).toFixed(4)
}

export function formatWeaponTransformForCatalog(
  weaponId: string,
  locomotion: PlayerLocomotion,
  values: WeaponTransformValues,
): string {
  return [
    `${weaponId}: {`,
    `  placementByLocomotion: {`,
    `    ${locomotion}: {`,
    `      position: [${formatNum(values.position.x)}, ${formatNum(values.position.y)}, ${formatNum(values.position.z)}],`,
    `      rotation: [${formatNum(values.rotation.x)}, ${formatNum(values.rotation.y)}, ${formatNum(values.rotation.z)}],`,
    `      scale: [${formatNum(values.scale.x)}, ${formatNum(values.scale.y)}, ${formatNum(values.scale.z)}],`,
    `    },`,
    `  },`,
    `},`,
  ].join('\n')
}
