import * as THREE from 'three';

export interface Mesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  object3d: THREE.Object3D;
}

export function createMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[]
): Mesh {
  const object3d = new THREE.Mesh(geometry, material);
  return {
    geometry,
    material,
    object3d,
  };
}
