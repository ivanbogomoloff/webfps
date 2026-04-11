import type { PlayerLocomotion } from '../ecs/components/PlayerController';

export const PLAYER_LOCOMOTION_IDS = [
  'idle',
  'walk',
  'walk_left_d',
  'walk_right_d',
  'backwards',
  'backwards_left_d',
  'backwards_right_d',
  'left',
  'right',
  'idle_crouch',
  'walk_crouch',
  'walk_crouch_left_d',
  'walk_crouch_right_d',
  'backwards_crouch',
  'backwards_crouch_left_d',
  'backwards_crouch_right_d',
  'left_crouch',
  'right_crouch',
  'run_forward',
  'run_backward',
  'run_left',
  'run_right',
  'run_left_d',
  'run_right_d',
  'run_backward_left_d',
  'run_backward_right_d',
  'fire',
  'walk_fire',
  'walk_left_d_fire',
  'walk_right_d_fire',
  'backwards_fire',
  'backwards_left_d_fire',
  'backwards_right_d_fire',
  'left_fire',
  'right_fire',
  'idle_crouch_fire',
  'walk_crouch_fire',
  'walk_crouch_left_d_fire',
  'walk_crouch_right_d_fire',
  'backwards_crouch_fire',
  'backwards_crouch_left_d_fire',
  'backwards_crouch_right_d_fire',
  'left_crouch_fire',
  'right_crouch_fire',
  'run_forward_fire',
  'run_backward_fire',
  'run_left_fire',
  'run_right_fire',
  'run_left_d_fire',
  'run_right_d_fire',
  'run_backward_left_d_fire',
  'run_backward_right_d_fire',
  'jump_up',
] as const satisfies readonly PlayerLocomotion[];

const FIRE_LOCOMOTION_BY_BASE: Partial<Record<PlayerLocomotion, PlayerLocomotion>> = {
  idle: 'fire',
  walk: 'walk_fire',
  walk_left_d: 'walk_left_d_fire',
  walk_right_d: 'walk_right_d_fire',
  backwards: 'backwards_fire',
  backwards_left_d: 'backwards_left_d_fire',
  backwards_right_d: 'backwards_right_d_fire',
  left: 'left_fire',
  right: 'right_fire',
  idle_crouch: 'idle_crouch_fire',
  walk_crouch: 'walk_crouch_fire',
  walk_crouch_left_d: 'walk_crouch_left_d_fire',
  walk_crouch_right_d: 'walk_crouch_right_d_fire',
  backwards_crouch: 'backwards_crouch_fire',
  backwards_crouch_left_d: 'backwards_crouch_left_d_fire',
  backwards_crouch_right_d: 'backwards_crouch_right_d_fire',
  left_crouch: 'left_crouch_fire',
  right_crouch: 'right_crouch_fire',
  run_forward: 'run_forward_fire',
  run_backward: 'run_backward_fire',
  run_left: 'run_left_fire',
  run_right: 'run_right_fire',
  run_left_d: 'run_left_d_fire',
  run_right_d: 'run_right_d_fire',
  run_backward_left_d: 'run_backward_left_d_fire',
  run_backward_right_d: 'run_backward_right_d_fire',
};

export function isPlayerLocomotion(s: string): s is PlayerLocomotion {
  return (PLAYER_LOCOMOTION_IDS as readonly string[]).includes(s);
}

export function parseNetworkLocomotion(raw: string | undefined | null): PlayerLocomotion {
  if (raw && isPlayerLocomotion(raw)) return raw;
  return 'idle';
}

export function toFireLocomotion(base: PlayerLocomotion): PlayerLocomotion | null {
  return FIRE_LOCOMOTION_BY_BASE[base] ?? null;
}

/** Та же развилка, что в PlayerControllerSystem по fz (W/S) и fx (A/D) в осях игрока. */
export function locomotionFromStrafeAxes(fz: number, fx: number): PlayerLocomotion {
  if (fz === 0 && fx === 0) return 'idle';
  if (fz > 0 && fx !== 0) return fx > 0 ? 'walk_left_d' : 'walk_right_d';
  if (fz < 0 && fx !== 0) return fx > 0 ? 'backwards_left_d' : 'backwards_right_d';
  if (Math.abs(fz) >= Math.abs(fx)) return fz > 0 ? 'walk' : 'backwards';
  return fx > 0 ? 'left' : 'right';
}

const CROUCH_LOCOMOTION_BY_WALK: Partial<Record<PlayerLocomotion, PlayerLocomotion>> = {
  idle: 'idle_crouch',
  walk: 'walk_crouch',
  walk_left_d: 'walk_crouch_left_d',
  walk_right_d: 'walk_crouch_right_d',
  backwards: 'backwards_crouch',
  backwards_left_d: 'backwards_crouch_left_d',
  backwards_right_d: 'backwards_crouch_right_d',
  left: 'left_crouch',
  right: 'right_crouch',
  idle_crouch: 'idle_crouch',
  walk_crouch: 'walk_crouch',
  walk_crouch_left_d: 'walk_crouch_left_d',
  walk_crouch_right_d: 'walk_crouch_right_d',
  backwards_crouch: 'backwards_crouch',
  backwards_crouch_left_d: 'backwards_crouch_left_d',
  backwards_crouch_right_d: 'backwards_crouch_right_d',
  left_crouch: 'left_crouch',
  right_crouch: 'right_crouch',
  run_forward: 'run_forward',
  run_backward: 'run_backward',
  run_left: 'run_left',
  run_right: 'run_right',
  run_left_d: 'run_left_d',
  run_right_d: 'run_right_d',
  run_backward_left_d: 'run_backward_left_d',
  run_backward_right_d: 'run_backward_right_d',
  jump_up: 'jump_up',
};

export function toCrouchLocomotion(locomotion: PlayerLocomotion): PlayerLocomotion {
  return CROUCH_LOCOMOTION_BY_WALK[locomotion] ?? 'idle_crouch';
}

const RUN_LOCOMOTION_BY_WALK: Partial<Record<PlayerLocomotion, PlayerLocomotion>> = {
  idle: 'idle',
  walk: 'run_forward',
  walk_left_d: 'run_left_d',
  walk_right_d: 'run_right_d',
  backwards: 'run_backward',
  backwards_left_d: 'run_backward_left_d',
  backwards_right_d: 'run_backward_right_d',
  left: 'run_left',
  right: 'run_right',
  idle_crouch: 'idle',
  walk_crouch: 'run_forward',
  walk_crouch_left_d: 'run_left_d',
  walk_crouch_right_d: 'run_right_d',
  backwards_crouch: 'run_backward',
  backwards_crouch_left_d: 'run_backward_left_d',
  backwards_crouch_right_d: 'run_backward_right_d',
  left_crouch: 'run_left',
  right_crouch: 'run_right',
  run_forward: 'run_forward',
  run_backward: 'run_backward',
  run_left: 'run_left',
  run_right: 'run_right',
  run_left_d: 'run_left_d',
  run_right_d: 'run_right_d',
  run_backward_left_d: 'run_backward_left_d',
  run_backward_right_d: 'run_backward_right_d',
  jump_up: 'jump_up',
};

export function toRunLocomotion(locomotion: PlayerLocomotion): PlayerLocomotion {
  return RUN_LOCOMOTION_BY_WALK[locomotion] ?? 'idle';
}

/**
 * Мировая скорость XZ → «виртуальные» fz/fx как у ввода WASD в локальных осях yaw модели
 * (обратное к повороту из PlayerControllerSystem).
 */
export function strafeAxesFromWorldVelocity(
  rotY: number,
  vx: number,
  vz: number,
  eps = 0.04,
): { fz: number; fx: number } {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const ix = vx * cos - vz * sin;
  const iz = vx * sin + vz * cos;
  const fz = Math.abs(iz) > eps ? Math.sign(iz) : 0;
  const fx = Math.abs(ix) > eps ? Math.sign(ix) : 0;
  return { fz, fx };
}
