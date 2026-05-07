import * as THREE from 'three';

export interface PlayerPhysicsState {
  moveDirection: THREE.Vector3;
  jumpPending: boolean;
  isGrounded: boolean;
  isOnLadder: boolean;
  ladderClimbInput: number;
  ladderWantsDetach: boolean;
  ladderWantsSideDetach: boolean;
  ladderDetachUntilMs: number;
  ladderGravityDisabled: boolean;
}

export function createPlayerPhysicsState(): PlayerPhysicsState {
  return {
    moveDirection: new THREE.Vector3(0, 0, 0),
    jumpPending: false,
    isGrounded: true,
    isOnLadder: false,
    ladderClimbInput: 0,
    ladderWantsDetach: false,
    ladderWantsSideDetach: false,
    ladderDetachUntilMs: 0,
    ladderGravityDisabled: false,
  };
}
