import * as THREE from 'three';

/** Точка респауна: центр и размер бокса меша (мировые координаты). */
export type RespawnPoint = { center: THREE.Vector3; size: THREE.Vector3 };

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
    /** HDR-текстура окружения, если карта загружена с HDR. */
    public readonly environment?: THREE.Texture
  ) {}

  getRespawns(): ReadonlyArray<RespawnPoint> {
    return this.respawnPoints;
  }
}
