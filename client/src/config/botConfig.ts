export const BOT_NAV_CONFIG = {
  waypointsPerSquareMeter: 0.08,
  minWaypointsByMapId: {
    test2: 12,
    de_dust: 16,
  } as Record<string, number>,
  maxEdgeDistance: 25,
  botMoveSpeed: 5,
  botTickHz: 10,
  combatRange: 40,
  combatFovRad: (120 * Math.PI) / 180,
  weaponSwitchCooldownSec: 8,
  minWaypointSeparation: 2.5,
  groundRayHeight: 80,
  playerClearanceRadius: 0.45,
} as const

export function resolveWaypointCount(mapId: string, areaXZ: number): number {
  const min = BOT_NAV_CONFIG.minWaypointsByMapId[mapId] ?? 10
  const fromArea = Math.floor(areaXZ * BOT_NAV_CONFIG.waypointsPerSquareMeter)
  return Math.max(min, fromArea)
}
