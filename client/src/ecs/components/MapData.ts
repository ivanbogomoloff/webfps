import * as THREE from 'three';

export interface MapData {
  name: string;
  scene: THREE.Group;
  isLoaded: boolean;
}

export function createMapData(
  name: string,
  scene: THREE.Group
): MapData {
  return {
    name,
    scene,
    isLoaded: true,
  };
}
