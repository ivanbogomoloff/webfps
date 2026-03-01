import * as THREE from 'three';

export interface Camera {
  camera: THREE.PerspectiveCamera;
  isActive: boolean;
}

export function createCamera(
  fov: number = 75,
  aspect: number = window.innerWidth / window.innerHeight,
  near: number = 0.1,
  far: number = 1000
): Camera {
  return {
    camera: new THREE.PerspectiveCamera(fov, aspect, near, far),
    isActive: true,
  };
}
