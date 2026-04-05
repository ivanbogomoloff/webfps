import { createUniformWeaponPlacement, type WeaponModelConfig } from './types'

const base = createUniformWeaponPlacement({
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
})

export const rifle_m16ModelConfig: WeaponModelConfig = {
  id: 'm16',
  placementByLocomotion: {
    ...base,
    idle: {
      position: { x: 0.12, y: 0.02, z: -0.02 },
      rotation: { x: 1.5708, y: -1.5708, z: 0.5360 },
      scale: { x: 1, y: 1, z: 1 },
    },
  },
}
