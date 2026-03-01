import * as THREE from 'three';

export interface Transform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export function createTransform(
  position?: [number, number, number],
  rotation?: [number, number, number],
  scale?: [number, number, number]
): Transform {
  return {
    position: new THREE.Vector3(...(position || [0, 0, 0])),
    rotation: new THREE.Euler(...(rotation || [0, 0, 0])),
    scale: new THREE.Vector3(...(scale || [1, 1, 1])),
  };
}
