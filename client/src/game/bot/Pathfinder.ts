import type { BotNavGraphData, NavEdge, Waypoint } from './types';
import { distance3 } from './collisionQueries';

function heuristic(a: Waypoint, b: Waypoint): number {
  return distance3(a.x, a.y, a.z, b.x, b.y, b.z);
}

function buildAdjacency(edges: NavEdge[], nodeCount: number): Map<number, Array<{ to: number; weight: number }>> {
  const adj = new Map<number, Array<{ to: number; weight: number }>>();
  for (let i = 0; i < nodeCount; i += 1) {
    adj.set(i, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push({ to: edge.to, weight: edge.weight });
    adj.get(edge.to)?.push({ to: edge.from, weight: edge.weight });
  }
  return adj;
}

export function findPath(
  graph: BotNavGraphData,
  fromIndex: number,
  toIndex: number,
): number[] {
  const { waypoints, edges } = graph;
  if (fromIndex === toIndex) return [fromIndex];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= waypoints.length || toIndex >= waypoints.length) {
    return [];
  }

  const adj = buildAdjacency(edges, waypoints.length);
  const openSet = new Set<number>([fromIndex]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(fromIndex, 0);
  fScore.set(fromIndex, heuristic(waypoints[fromIndex]!, waypoints[toIndex]!));

  while (openSet.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const index of openSet) {
      const f = fScore.get(index) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = index;
      }
    }
    if (current < 0) return [];

    if (current === toIndex) {
      const path: number[] = [current];
      while (cameFrom.has(path[0]!)) {
        path.unshift(cameFrom.get(path[0]!)!);
      }
      return path;
    }

    openSet.delete(current);
    const currentG = gScore.get(current) ?? Infinity;

    for (const neighbor of adj.get(current) ?? []) {
      const tentativeG = currentG + neighbor.weight;
      if (tentativeG >= (gScore.get(neighbor.to) ?? Infinity)) continue;
      cameFrom.set(neighbor.to, current);
      gScore.set(neighbor.to, tentativeG);
      fScore.set(neighbor.to, tentativeG + heuristic(waypoints[neighbor.to]!, waypoints[toIndex]!));
      openSet.add(neighbor.to);
    }
  }

  return [];
}

export function findNearestWaypointIndex(
  waypoints: Waypoint[],
  x: number,
  y: number,
  z: number,
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < waypoints.length; i += 1) {
    const wp = waypoints[i]!;
    const dist = distance3(x, y, z, wp.x, wp.y, wp.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

export function pickRandomWaypointIndex(
  waypoints: Waypoint[],
  excludeIndex: number,
  random: () => number = Math.random,
): number {
  if (waypoints.length <= 1) return 0;
  let index = Math.floor(random() * waypoints.length);
  if (index === excludeIndex) {
    index = (index + 1) % waypoints.length;
  }
  return index;
}
