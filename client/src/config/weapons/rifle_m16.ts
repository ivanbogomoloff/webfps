import { createUniformWeaponPlacement, type WeaponModelConfig } from './types'

const base = createUniformWeaponPlacement({
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
})

const walk = {
  position: {x: -1.3080, y: -0.4400, z: -0.3780},
  rotation: {x: 1.3930, y: -1.4100, z: 0.7700},
  scale: {x: 1.0000, y: 1.0000, z: 1.0000},
};

const run = {
  position: { x: -0.8740, y: -0.3780, z: -0.5020 },
  rotation: { x: 1.4710, y: -1.4880, z: 0.5360 },
  scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
};

export const rifle_m16ModelConfig: WeaponModelConfig = {
  id: 'm16',
  placementByLocomotion: {
    ...base,
    idle: {
      position: { x: 0.12, y: 0.02, z: -0.02 },
      rotation: { x: 1.5708, y: -1.5708, z: 0.5360 },
      scale: { x: 1, y: 1, z: 1 },
    },
    walk: walk,
    left: walk,
    right: walk,
    backwards: walk,
    backwards_left_d: walk,
    backwards_right_d: walk,
    walk_left_d: walk,
    walk_right_d: walk,
    fire: {
      position: {x: -1.0600, y: -0.4400, z: -0.0690},
      rotation: {x: 1.5708, y: -1.5650, z: 0.3810},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    walk_fire: {
      position: { x: -1.3080, y: -0.4400, z: 0.3650 },
      rotation: { x: 1.3930, y: -1.4100, z: 0.3810 },
      scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
    },
    walk_crouch: {
      position: {x: -1.0600, y: -0.9360, z: -0.8120},
      rotation: {x: 1.5708, y: -1.4100, z: 0.6140},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    left_crouch: {
      position: {x: -1.3700, y: -0.7500, z: -0.5640},
      rotation: {x: 1.5708, y: -1.4100, z: 0.7700},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    right_crouch: {
      position: {x: -1.0600, y: -0.9360, z: -0.8120},
      rotation: {x: 1.5708, y: -1.4100, z: 0.6140},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    walk_crouch_left_d: {
      position: {x: -0.6880, y: -0.7500, z: -0.9980},
      rotation: {x: 1.5708, y: -1.4100, z: 0.7700},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    walk_crouch_right_d: {
      position: {x: -1.0600, y: -0.9360, z: -0.8120},
      rotation: {x: 1.5708, y: -1.4100, z: 0.6140},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    backwards_crouch: {
      position: { x: -1.4320, y: -0.7500, z: -0.6260 },
      rotation: { x: 1.5708, y: -1.4100, z: 0.4590 },
      scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
    },
    backwards_crouch_left_d: {
      position: { x: -1.4320, y: -0.7500, z: -0.6260 },
      rotation: { x: 1.5708, y: -1.4100, z: 0.4590 },
      scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
    },
    backwards_crouch_right_d: {
      position: {x: -1.0600, y: -0.9360, z: -0.8120},
      rotation: {x: 1.5708, y: -1.4100, z: 0.6140},
      scale: {x: 1.0000, y: 1.0000, z: 1.0000},
    },
    idle_crouch: {
      position: { x: 0.1200, y: -0.5640, z: -0.0200 },
      rotation: { x: 0.9260, y: -1.4880, z: 0.3030 },
      scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
    },
    jump_up: {
      position: { x: 0.1200, y: -0.3780, z: -0.0200 },
      rotation: { x: 1.5708, y: -1.5708, z: 0.4590 },
      scale: { x: 1.0000, y: 1.0000, z: 1.0000 },
    },
    run_forward: run,
    run_backward: run,
    run_left: run,
    run_right: run,
    run_left_d: run,
    run_right_d: run,
    run_backward_left_d: run,
    run_backward_right_d: run,
  },
}
