import {
  createUniformFpWeaponPlacement,
  createUniformWeaponPlacement,
  type WeaponModelConfig,
} from './types'

const fpBase = createUniformFpWeaponPlacement({
  position: { x: 0.22, y: -0.22, z: -0.35 },
  rotation: { x: 0, y: Math.PI, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
})

export const rifle_ak47ModelConfig: WeaponModelConfig = {
  id: 'm16',
  placementByLocomotion: createUniformWeaponPlacement({
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }),
  fpPlacementByAnimation: {
    ...fpBase,
    walk: {
      position: { x: 0.25, y: -0.24, z: -0.39 },
      rotation: { x: -0.03, y: Math.PI, z: -0.02 },
      scale: { x: 1, y: 1, z: 1 },
    },
    run: {
      position: { x: 0.3, y: -0.34, z: -0.53 },
      rotation: { x: 0.08, y: Math.PI, z: -0.12 },
      scale: { x: 1, y: 1, z: 1 },
    },
    fire: {
      position: { x: 0.21, y: -0.225, z: -0.345 },
      rotation: { x: 0.015, y: Math.PI, z: 0.02 },
      scale: { x: 1, y: 1, z: 1 },
    },
    reload: {
      position: { x: 0.35, y: -0.3, z: -0.27 },
      rotation: { x: -0.2, y: 2.7, z: -0.19 },
      scale: { x: 1, y: 1, z: 1 },
    },
  },
}
