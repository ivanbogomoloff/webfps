import * as THREE from 'three';
import type { PlayerLocomotion } from './PlayerController';

export const PLAYER_ANIMATION_FADE_DURATION = 0.2;

export interface PlayerAnimationActions {
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  walk_left_d: THREE.AnimationAction | null;
  walk_right_d: THREE.AnimationAction | null;
  backwards: THREE.AnimationAction | null;
  left: THREE.AnimationAction | null;
  right: THREE.AnimationAction | null;
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
  walk_left_d?: THREE.AnimationClip | null;
  walk_right_d?: THREE.AnimationClip | null;
  backwards?: THREE.AnimationClip | null;
  left?: THREE.AnimationClip | null;
  right?: THREE.AnimationClip | null;
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
    case 'walk_left_d':
      return actions.walk_left_d ?? actions.walk;
    case 'walk_right_d':
      return actions.walk_right_d ?? actions.walk;
    case 'backwards':
      return actions.backwards ?? actions.walk;
    case 'left':
      return actions.left ?? actions.walk;
    case 'right':
      return actions.right ?? actions.walk;
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
      walk_left_d: makeAction(mixer, clips.walk_left_d ?? null),
      walk_right_d: makeAction(mixer, clips.walk_right_d ?? null),
      backwards: makeAction(mixer, clips.backwards ?? null),
      left: makeAction(mixer, clips.left ?? null),
      right: makeAction(mixer, clips.right ?? null),
    },
    current: 'idle',
  };
}
