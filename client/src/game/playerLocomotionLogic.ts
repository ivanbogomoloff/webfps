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
  'jump_up',
] as const satisfies readonly PlayerLocomotion[];

export function isPlayerLocomotion(s: string): s is PlayerLocomotion {
  return (PLAYER_LOCOMOTION_IDS as readonly string[]).includes(s);
}

export function parseNetworkLocomotion(raw: string | undefined | null): PlayerLocomotion {
  if (raw && isPlayerLocomotion(raw)) return raw;
  return 'idle';
}

/** Та же развилка, что в PlayerControllerSystem по fz (W/S) и fx (A/D) в осях игрока. */
export function locomotionFromStrafeAxes(fz: number, fx: number): PlayerLocomotion {
  if (fz === 0 && fx === 0) return 'idle';
  if (fz > 0 && fx !== 0) return fx > 0 ? 'walk_left_d' : 'walk_right_d';
  if (fz < 0 && fx !== 0) return fx > 0 ? 'backwards_left_d' : 'backwards_right_d';
  if (Math.abs(fz) >= Math.abs(fx)) return fz > 0 ? 'walk' : 'backwards';
  return fx > 0 ? 'left' : 'right';
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
