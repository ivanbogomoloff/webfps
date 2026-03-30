import * as THREE from 'three';

export interface PlayerPhysicsState {
  moveDirection: THREE.Vector3;
  jumpPending: boolean;
  isGrounded: boolean;
}

export function createPlayerPhysicsState(): PlayerPhysicsState {
  return {
    moveDirection: new THREE.Vector3(0, 0, 0),
    jumpPending: false,
    isGrounded: true,
  };
}
