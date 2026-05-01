import {
  createUniformFpWeaponPlacement,
  createUniformWeaponPlacement,
  type WeaponModelConfig,
} from './types'

const fpBase = createUniformFpWeaponPlacement({
  position: { x: 0.22, y: -0.3, z: -0.3 },
  rotation: { x: 0, y: 14, z: 0 },
  scale: { x: 0.5, y: 0.5, z: 0.5 },
});

const base = createUniformWeaponPlacement({
  position: { x: -1.5550, y: 0.1170, z: -1.5550 },
  rotation: { x: 1.5480, y: -3.1220, z: 0.5360 },
  scale: { x: 2.5000, y: 2.5000, z: 2.5000 },
});

const base2 = {
  position: { x: -0.8120, y: -0.0690, z: -0.9360 },
  rotation: { x: 1.5480, y: -2.8890, z: 0.5360 },
  scale: { x: 2.5000, y: 2.5000, z: 2.5000 },
}

export const rifle_ak47ModelConfig: WeaponModelConfig = {
  id: 'ak47',
  magazineSize: 30,
  reloadTimeSec: 2.8,
  placementByLocomotion: {
    ...base,
    walk: base2,
    left: base2,
    right: base2,
    backwards: base2,
    backwards_left_d: base2,
    backwards_right_d: base2,
    walk_left_d: base2,
    walk_right_d: base2,
    fire: base2,
    walk_fire: base2,
    walk_crouch: base2,
    left_crouch: base2,
    right_crouch: base2,
    walk_crouch_left_d: base2,
    walk_crouch_right_d: base2,
    backwards_crouch: base2,
    backwards_crouch_left_d: base2,
    backwards_crouch_right_d: base2,
    idle_crouch: base2,
    jump_up: base2,
    run_forward: base2,
    run_backward: base2,
    run_left: base2,
    run_right: base2,
    run_left_d: base2,
    run_right_d: base2,
    run_backward_left_d: base2,
    run_backward_right_d: base2,
  },
  fpPlacementByAnimation: {
    ...fpBase
  },
  audio: {
    shot: {
      src: '/audio/weapons/ak47_shot.mp3',
      volume: 0.7,
      refDistance: 11,
      maxDistance: 64,
    },
    emptyShot: {
      src: '/audio/weapons/ak47_empty_shot.mp3',
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
