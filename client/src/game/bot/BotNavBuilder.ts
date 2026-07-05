import * as THREE from 'three';
import { BOT_NAV_CONFIG, resolveWaypointCount } from '../../config/botConfig';
import type { BoundsXZ, CollisionVolume } from '../map/Map';
import type { AmmoPhysicsContext } from '../../ecs/systems/PhysicsSystem';
import {
  distance3,
  findGroundPoint,
  hasLineOfSight,
  isInsideCollisionVolume,
} from './collisionQueries';
import type { BotNavGraphData, NavEdge, Waypoint } from './types';

const fromVec = new THREE.Vector3();
const toVec = new THREE.Vector3();

function isTooCloseToExisting(
  waypoints: Waypoint[],
  x: number,
  y: number,
  z: number,
  minSep: number,
): boolean {
  for (const wp of waypoints) {
    if (distance3(x, y, z, wp.x, wp.y, wp.z) < minSep) return true;
  }
  return false;
}

function countEdgesForNode(edges: NavEdge[], index: number): number {
  let count = 0;
  for (const edge of edges) {
    if (edge.from === index || edge.to === index) count += 1;
  }
  return count;
}

export function buildBotNavGraph(options: {
  mapId: string;
  boundsXZ: BoundsXZ;
  collisionVolumes: ReadonlyArray<CollisionVolume>;
  physicsContext: AmmoPhysicsContext;
  random?: () => number;
}): BotNavGraphData {
  const { mapId, boundsXZ, collisionVolumes, physicsContext } = options;
  const random = options.random ?? Math.random;
  const targetCount = resolveWaypointCount(mapId, boundsXZ.area);
  const waypoints: Waypoint[] = [];
  const maxAttempts = targetCount * 40;
  let attempts = 0;

  while (waypoints.length < targetCount && attempts < maxAttempts) {
    attempts += 1;
    const x = boundsXZ.minX + random() * (boundsXZ.maxX - boundsXZ.minX);
    const z = boundsXZ.minZ + random() * (boundsXZ.maxZ - boundsXZ.minZ);
    const ground = findGroundPoint(physicsContext, x, z);
    if (!ground) continue;
    if (isInsideCollisionVolume(collisionVolumes, ground.x, ground.y, ground.z)) continue;
    if (isTooCloseToExisting(waypoints, ground.x, ground.y, ground.z, BOT_NAV_CONFIG.minWaypointSeparation)) {
      continue;
    }
    waypoints.push(ground);
  }

  const edges: NavEdge[] = [];
  for (let i = 0; i < waypoints.length; i += 1) {
    for (let j = i + 1; j < waypoints.length; j += 1) {
      const a = waypoints[i]!;
      const b = waypoints[j]!;
      const dist = distance3(a.x, a.y, a.z, b.x, b.y, b.z);
      if (dist > BOT_NAV_CONFIG.maxEdgeDistance) continue;
      fromVec.set(a.x, a.y + 0.5, a.z);
      toVec.set(b.x, b.y + 0.5, b.z);
      if (!hasLineOfSight(physicsContext, fromVec, toVec)) continue;
      edges.push({ from: i, to: j, weight: dist });
    }
  }

  const connected = waypoints
    .map((_, index) => ({ index, edgeCount: countEdgesForNode(edges, index) }))
    .filter((item) => item.edgeCount > 0)
    .map((item) => item.index);

  const filteredWaypoints = connected.map((index) => waypoints[index]!);
  const remap = new Map<number, number>();
  connected.forEach((oldIndex, newIndex) => remap.set(oldIndex, newIndex));

  const filteredEdges: NavEdge[] = [];
  for (const edge of edges) {
    const from = remap.get(edge.from);
    const to = remap.get(edge.to);
    if (from == null || to == null || from === to) continue;
    filteredEdges.push({ from, to, weight: edge.weight });
  }

  return {
    mapId,
    waypoints: filteredWaypoints,
    edges: filteredEdges,
    builtAtMs: Date.now(),
  };
}
