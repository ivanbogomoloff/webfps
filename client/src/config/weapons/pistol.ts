import { createUniformWeaponPlacement, type WeaponModelConfig } from './types'

export const pistolModelConfig: WeaponModelConfig = {
  id: 'colt_m4a1_low-poly',
  placementByLocomotion: createUniformWeaponPlacement({
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }),
}
