import * as THREE from 'three';

export interface RigidBody {
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  isKinematic: boolean;
}

export function createRigidBody(
  mass: number = 1,
  isKinematic: boolean = false
): RigidBody {
  return {
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    mass,
    isKinematic,
  };
}
