import manifestJson from '../../../shared/maps/maps.json'

export interface MapManifestEntry {
  id: string
  name: string
  spawnCount: number
  path: string
  hdrPath?: string
}

interface MapManifestFile {
  maps: MapManifestEntry[]
}

const manifest = manifestJson as MapManifestFile

export const DEFAULT_MAP_ID = 'test2'

function findMapEntry(mapId: string): MapManifestEntry | undefined {
  const normalized = mapId.trim() || DEFAULT_MAP_ID
  return manifest.maps.find((map) => map.id === normalized)
}

export function getManifestMaps(): readonly MapManifestEntry[] {
  return manifest.maps
}

export function getSpawnCountByMap(mapId: string): number {
  const item = findMapEntry(mapId)
  return item?.spawnCount ?? 4
}

export function resolveMapAssets(mapId: string): { mapPath: string; hdrPath?: string } {
  const normalized = mapId.trim() || DEFAULT_MAP_ID
  const map =
    findMapEntry(normalized) ?? manifest.maps.find((entry) => entry.id === DEFAULT_MAP_ID)

  if (!map) {
    throw new Error('[mapManifest] Map manifest is empty or missing default map "test2"')
  }

  if (map.id !== normalized) {
    console.warn(`[mapManifest] Unknown mapId "${mapId}", using "${map.id}"`)
  }

  return { mapPath: map.path, hdrPath: map.hdrPath }
}
