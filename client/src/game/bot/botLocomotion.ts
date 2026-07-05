import type { PlayerLocomotion } from '../../ecs/components/PlayerController';
import {
  locomotionFromStrafeAxes,
  strafeAxesFromWorldVelocity,
  toFireLocomotion,
} from '../player/playerLocomotionLogic';

export function locomotionFromVelocity(rotY: number, vx: number, vz: number): PlayerLocomotion {
  const { fz, fx } = strafeAxesFromWorldVelocity(rotY, vx, vz);
  return locomotionFromStrafeAxes(fz, fx);
}

export function fireLocomotionFromVelocity(rotY: number, vx: number, vz: number): PlayerLocomotion {
  const base = locomotionFromVelocity(rotY, vx, vz);
  return toFireLocomotion(base) ?? 'fire';
}

export function yawTowardTarget(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

export function isInFov(
  rotY: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  fovRad: number,
): boolean {
  const targetYaw = yawTowardTarget(fromX, fromZ, toX, toZ);
  let delta = targetYaw - rotY;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta) <= fovRad * 0.5;
}
