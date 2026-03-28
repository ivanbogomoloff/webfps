import manifestJson from '../../../shared/maps/maps.json'

export interface MapManifestEntry {
  id: string
  name: string
  spawnCount: number
}

interface MapManifestFile {
  maps: MapManifestEntry[]
}

const manifest = manifestJson as MapManifestFile

export function getSpawnCountByMap(mapId: string): number {
  const item = manifest.maps.find((map) => map.id === mapId)
  return item?.spawnCount ?? 4
}
