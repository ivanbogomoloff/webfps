import * as THREE from 'three';

export interface PlayerAnimation {
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction;
  walkAction: THREE.AnimationAction;
  current: 'idle' | 'walk';
}

export function createPlayerAnimation(
  root: THREE.Object3D,
  idleClip: THREE.AnimationClip,
  walkClip: THREE.AnimationClip,
): PlayerAnimation {
  const mixer = new THREE.AnimationMixer(root);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  idleAction.play();
  return {
    mixer,
    idleAction,
    walkAction,
    current: 'idle',
  };
}
