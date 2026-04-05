import { createUniformWeaponPlacement, type WeaponModelConfig } from './types'

export const rifle_ak47ModelConfig: WeaponModelConfig = {
  id: 'm16',
  placementByLocomotion: createUniformWeaponPlacement({
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }),
}
