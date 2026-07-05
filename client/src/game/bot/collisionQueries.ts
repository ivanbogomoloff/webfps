import * as THREE from 'three';
import type { CollisionVolume } from '../map/Map';
import type { AmmoPhysicsContext } from '../../ecs/systems/PhysicsSystem';
import { BOT_NAV_CONFIG } from '../../config/botConfig';

const rayFromWorld = new THREE.Vector3();
const rayToWorld = new THREE.Vector3();

export function raycastWorld(
  physicsContext: AmmoPhysicsContext,
  from: THREE.Vector3,
  to: THREE.Vector3,
): boolean {
  const { ammo, physicsWorld } = physicsContext;
  if (!ammo || !physicsWorld) return false;

  rayFromWorld.copy(from);
  rayToWorld.copy(to);

  const rayFrom = new ammo.btVector3(rayFromWorld.x, rayFromWorld.y, rayFromWorld.z);
  const rayTo = new ammo.btVector3(rayToWorld.x, rayToWorld.y, rayToWorld.z);
  const callback = new ammo.ClosestRayResultCallback(rayFrom, rayTo);
  callback.set_m_closestHitFraction(1);
  callback.set_m_rayFromWorld(rayFrom);
  callback.set_m_rayToWorld(rayTo);
  physicsWorld.rayTest(rayFrom, rayTo, callback);
  const hasHit = callback.hasHit();
  ammo.destroy(callback);
  ammo.destroy(rayFrom);
  ammo.destroy(rayTo);
  return hasHit;
}

export function hasLineOfSight(
  physicsContext: AmmoPhysicsContext,
  from: THREE.Vector3,
  to: THREE.Vector3,
): boolean {
  return !raycastWorld(physicsContext, from, to);
}

export function findGroundPoint(
  physicsContext: AmmoPhysicsContext,
  x: number,
  z: number,
  clearanceRadius = BOT_NAV_CONFIG.playerClearanceRadius,
): { x: number; y: number; z: number } | null {
  const from = new THREE.Vector3(x, BOT_NAV_CONFIG.groundRayHeight, z);
  const to = new THREE.Vector3(x, -BOT_NAV_CONFIG.groundRayHeight, z);
  const { ammo, physicsWorld } = physicsContext;
  if (!ammo || !physicsWorld) return null;

  const rayFrom = new ammo.btVector3(from.x, from.y, from.z);
  const rayTo = new ammo.btVector3(to.x, to.y, to.z);
  const callback = new ammo.ClosestRayResultCallback(rayFrom, rayTo);
  callback.set_m_closestHitFraction(1);
  callback.set_m_rayFromWorld(rayFrom);
  callback.set_m_rayToWorld(rayTo);
  physicsWorld.rayTest(rayFrom, rayTo, callback);

  if (!callback.hasHit()) {
    ammo.destroy(callback);
    ammo.destroy(rayFrom);
    ammo.destroy(rayTo);
    return null;
  }

  const pointVec = callback.get_m_hitPointWorld?.();
  if (!pointVec) {
    ammo.destroy(callback);
    ammo.destroy(rayFrom);
    ammo.destroy(rayTo);
    return null;
  }

  const y = pointVec.y() + clearanceRadius;
  ammo.destroy(callback);
  ammo.destroy(rayFrom);
  ammo.destroy(rayTo);
  return { x, y, z };
}

export function isInsideCollisionVolume(
  volumes: ReadonlyArray<CollisionVolume>,
  x: number,
  y: number,
  z: number,
  margin = BOT_NAV_CONFIG.playerClearanceRadius,
): boolean {
  for (const vol of volumes) {
    if (
      x >= vol.min.x - margin &&
      x <= vol.max.x + margin &&
      y >= vol.min.y - margin &&
      y <= vol.max.y + margin &&
      z >= vol.min.z - margin &&
      z <= vol.max.z + margin
    ) {
      return true;
    }
  }
  return false;
}

export function distance3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distanceXZ(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
