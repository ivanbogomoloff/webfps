import * as THREE from 'three';
import { BOT_NAV_CONFIG } from '../../config/botConfig';
import type { AmmoPhysicsContext } from '../../ecs/systems/PhysicsSystem';
import { hasLineOfSight } from './collisionQueries';
import { fireLocomotionFromVelocity, locomotionFromVelocity, yawTowardTarget } from './botLocomotion';
import { findNearestWaypointIndex, findPath, pickRandomWaypointIndex } from './Pathfinder';
import type { BotMovementDecision, BotNavGraphData } from './types';

const fromVec = new THREE.Vector3();
const toVec = new THREE.Vector3();

export type BotMovementState = {
  waypointIndex: number;
  path: number[];
  pathCursor: number;
};

export function createBotMovementState(): BotMovementState {
  return { waypointIndex: 0, path: [], pathCursor: 0 };
}

export function stepBotMovement(options: {
  graph: BotNavGraphData;
  physicsContext: AmmoPhysicsContext;
  x: number;
  y: number;
  z: number;
  rotY: number;
  state: BotMovementState;
  deltaTime: number;
  random?: () => number;
}): BotMovementDecision {
  const { graph, physicsContext, state, deltaTime } = options;
  let { x, y, z, rotY } = options;
  const random = options.random ?? Math.random;

  if (graph.waypoints.length === 0) {
    return { x, y, z, rotY, locomotion: 'idle', waypointIndex: 0, path: [] };
  }

  const nearest = findNearestWaypointIndex(graph.waypoints, x, y, z);
  if (state.path.length === 0 || state.pathCursor >= state.path.length) {
    const goal = pickRandomWaypointIndex(graph.waypoints, state.waypointIndex, random);
    state.waypointIndex = goal;
    const goalWp = graph.waypoints[goal]!;
    fromVec.set(x, y + 0.5, z);
    toVec.set(goalWp.x, goalWp.y + 0.5, goalWp.z);
    if (hasLineOfSight(physicsContext, fromVec, toVec)) {
      state.path = [goal];
    } else {
      state.path = findPath(graph, nearest, goal);
      if (state.path.length === 0) state.path = [goal];
    }
    state.pathCursor = 0;
  }

  const targetIndex = state.path[state.pathCursor] ?? state.waypointIndex;
  const target = graph.waypoints[targetIndex]!;
  const dx = target.x - x;
  const dz = target.z - z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const arriveRadius = 0.6;

  if (dist <= arriveRadius) {
    if (state.pathCursor < state.path.length - 1) {
      state.pathCursor += 1;
    } else {
      state.path = [];
      state.pathCursor = 0;
    }
    return {
      x,
      y: target.y,
      z,
      rotY,
      locomotion: 'idle',
      waypointIndex: targetIndex,
      path: [...state.path],
    };
  }

  const speed = BOT_NAV_CONFIG.botMoveSpeed;
  const step = Math.min(dist, speed * deltaTime);
  const nx = x + (dx / dist) * step;
  const nz = z + (dz / dist) * step;
  const vy = target.y;
  const nextRotY = yawTowardTarget(x, z, target.x, target.z);
  const vx = (nx - x) / Math.max(deltaTime, 1e-6);
  const vz = (nz - z) / Math.max(deltaTime, 1e-6);
  const locomotion = locomotionFromVelocity(nextRotY, vx, vz);

  return {
    x: nx,
    y: vy,
    z: nz,
    rotY: nextRotY,
    locomotion,
    waypointIndex: targetIndex,
    path: [...state.path],
  };
}

export function stepBotCombatMovement(options: {
  x: number;
  y: number;
  z: number;
  rotY: number;
  targetX: number;
  targetZ: number;
  deltaTime: number;
  stopDistance?: number;
}): BotMovementDecision {
  const { x, y, z, targetX, targetZ, deltaTime } = options;
  const stopDistance = options.stopDistance ?? 6;
  const rotY = yawTowardTarget(x, z, targetX, targetZ);
  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= stopDistance) {
    return { x, y, z, rotY, locomotion: fireLocomotionFromVelocity(rotY, 0, 0), waypointIndex: 0, path: [] };
  }

  const speed = BOT_NAV_CONFIG.botMoveSpeed * 0.85;
  const step = Math.min(dist - stopDistance, speed * deltaTime);
  const nx = x + (dx / dist) * step;
  const nz = z + (dz / dist) * step;
  const vx = (nx - x) / Math.max(deltaTime, 1e-6);
  const vz = (nz - z) / Math.max(deltaTime, 1e-6);

  return {
    x: nx,
    y,
    z: nz,
    rotY,
    locomotion: fireLocomotionFromVelocity(rotY, vx, vz),
    waypointIndex: 0,
    path: [],
  };
}
