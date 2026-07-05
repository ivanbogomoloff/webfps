import * as THREE from 'three';

/** Точка респауна: центр и размер бокса меша (мировые координаты). */
export type RespawnPoint = { center: THREE.Vector3; size: THREE.Vector3 };
export type LadderVolume = { min: THREE.Vector3; max: THREE.Vector3; name: string };
export type CollisionVolume = { min: THREE.Vector3; max: THREE.Vector3; name: string };
export type BoundsXZ = { minX: number; maxX: number; minZ: number; maxZ: number; area: number };

/**
 * Результат сборки карты: сцена с мешами, точки респауна и опциональное HDR-окружение.
 * Из экземпляра можно получить респауны для позиционирования игрока.
 */
export class Map {
  constructor(
    /** Сцена карты (THREE.Group) для добавления в игровую сцену. */
    public readonly scene: THREE.Group,
    /** Точки респауна (меши с userData.respawn === true). */
    public readonly respawnPoints: ReadonlyArray<RespawnPoint>,
    /** Объёмы лестниц (мировые AABB). */
    public readonly ladderVolumes: ReadonlyArray<LadderVolume>,
    /** AABB физических коллайдеров карты. */
    public readonly collisionVolumes: ReadonlyArray<CollisionVolume>,
    /** HDR-текстура окружения, если карта загружена с HDR. */
    public readonly environment?: THREE.Texture
  ) {}

  getRespawns(): ReadonlyArray<RespawnPoint> {
    return this.respawnPoints;
  }

  getLadders(): ReadonlyArray<LadderVolume> {
    return this.ladderVolumes;
  }

  getCollisionVolumes(): ReadonlyArray<CollisionVolume> {
    return this.collisionVolumes;
  }

  getBoundsXZ(): BoundsXZ {
    if (this.collisionVolumes.length === 0) {
      return { minX: -50, maxX: 50, minZ: -50, maxZ: 50, area: 10000 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const vol of this.collisionVolumes) {
      minX = Math.min(minX, vol.min.x);
      maxX = Math.max(maxX, vol.max.x);
      minZ = Math.min(minZ, vol.min.z);
      maxZ = Math.max(maxZ, vol.max.z);
    }
    const width = Math.max(1, maxX - minX);
    const depth = Math.max(1, maxZ - minZ);
    return { minX, maxX, minZ, maxZ, area: width * depth };
  }
}
