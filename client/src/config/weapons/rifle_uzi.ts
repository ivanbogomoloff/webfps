import {
  createUniformFpWeaponPlacement,
  createUniformWeaponPlacement,
  type WeaponModelConfig,
} from './types'

const fpBase = createUniformFpWeaponPlacement({
  position: { x: 0.6470, y: -2.6890, z: -3.3660 },
    rotation: { x: 0.0000, y: 3.1430, z: 0.0290 },
    scale: { x: 0.1330, y: 0.1330, z: 0.1330 },
})

const base = createUniformWeaponPlacement({
  position: { x: -1.5550, y: 0.1170, z: -1.5550 },
  rotation: { x: 1.5480, y: -3.1220, z: 0.5360 },
  scale: { x: 2.5000, y: 2.5000, z: 2.5000 },
})

export const rifle_uziModelConfig: WeaponModelConfig = {
  id: 'uzi_2026__first_person_animations',
  magazineSize: 30,
  reloadTimeSec: 2.5,
  pickTimeSec: 2,
  placementByLocomotion: base,
  fpPlacementByAnimation: {
    ...fpBase,
  },
  audio: {
    shot: {
      src: '/audio/weapons/ak47_shot.mp3',
      volume: 0.7,
      refDistance: 11,
      maxDistance: 64,
    },
    reload: {
      src: '/audio/weapons/reload.mp3',
    },
    emptyShot: {
      src: '/audio/weapons/empty_shot.mp3',
      volume: 0.7,
      refDistance: 8,
      maxDistance: 40,
    },
  },
  crosshair: {
    color: '#ffdca8',
    gapPx: 8,
    armLengthPx: 12,
    armThicknessPx: 2.5,
    baseScale: 1.05,
    shotPulseScale: 0.28,
    pulseDecayPerSec: 7.2,
  },
}
