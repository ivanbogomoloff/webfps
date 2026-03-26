import * as THREE from 'three';
import type { PlayerLocomotion } from './PlayerController';

export const PLAYER_ANIMATION_FADE_DURATION = 0.2;

export interface PlayerAnimationActions {
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  backwards: THREE.AnimationAction | null;
  left_st: THREE.AnimationAction | null;
  right_st: THREE.AnimationAction | null;
}

export interface PlayerAnimation {
  mixer: THREE.AnimationMixer;
  actionByLocomotion: PlayerAnimationActions;
  /** Последняя выбранная локомоция (логическая, до fallback клипов). */
  current: PlayerLocomotion;
}

export type PlayerAnimationClips = {
  idle: THREE.AnimationClip;
  walk: THREE.AnimationClip;
  backwards?: THREE.AnimationClip | null;
  left_st?: THREE.AnimationClip | null;
  right_st?: THREE.AnimationClip | null;
};

function makeAction(
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null | undefined,
): THREE.AnimationAction | null {
  if (!clip) return null;
  return mixer.clipAction(clip);
}

/** Какое действие микшера соответствует логической локомоции (с запасными клипами). */
export function pickAnimationAction(
  actions: PlayerAnimationActions,
  locomotion: PlayerLocomotion,
): THREE.AnimationAction {
  switch (locomotion) {
    case 'idle':
      return actions.idle;
    case 'walk':
      return actions.walk;
    case 'backwards':
      return actions.backwards ?? actions.walk;
    case 'left_st':
      return actions.left_st ?? actions.walk;
    case 'right_st':
      return actions.right_st ?? actions.walk;
    default:
      return actions.idle;
  }
}

export function createPlayerAnimation(
  root: THREE.Object3D,
  clips: PlayerAnimationClips,
): PlayerAnimation {
  const mixer = new THREE.AnimationMixer(root);
  const idleAction = mixer.clipAction(clips.idle);
  const walkAction = mixer.clipAction(clips.walk);
  idleAction.play();
  return {
    mixer,
    actionByLocomotion: {
      idle: idleAction,
      walk: walkAction,
      backwards: makeAction(mixer, clips.backwards ?? null),
      left_st: makeAction(mixer, clips.left_st ?? null),
      right_st: makeAction(mixer, clips.right_st ?? null),
    },
    current: 'idle',
  };
}
