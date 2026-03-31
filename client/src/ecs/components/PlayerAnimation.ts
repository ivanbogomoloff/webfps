import * as THREE from 'three';
import type { PlayerLocomotion } from './PlayerController';

export const PLAYER_ANIMATION_FADE_DURATION = 0.2;

export interface PlayerAnimationActions {
  idle: THREE.AnimationAction;
  walk: THREE.AnimationAction;
  walk_left_d: THREE.AnimationAction | null;
  walk_right_d: THREE.AnimationAction | null;
  backwards: THREE.AnimationAction | null;
  backwards_left_d: THREE.AnimationAction | null;
  backwards_right_d: THREE.AnimationAction | null;
  left: THREE.AnimationAction | null;
  right: THREE.AnimationAction | null;
  idle_crouch: THREE.AnimationAction | null;
  walk_crouch: THREE.AnimationAction | null;
  walk_crouch_left_d: THREE.AnimationAction | null;
  walk_crouch_right_d: THREE.AnimationAction | null;
  backwards_crouch: THREE.AnimationAction | null;
  backwards_crouch_left_d: THREE.AnimationAction | null;
  backwards_crouch_right_d: THREE.AnimationAction | null;
  left_crouch: THREE.AnimationAction | null;
  right_crouch: THREE.AnimationAction | null;
  run_forward: THREE.AnimationAction | null;
  run_backward: THREE.AnimationAction | null;
  run_left: THREE.AnimationAction | null;
  run_right: THREE.AnimationAction | null;
  run_left_d: THREE.AnimationAction | null;
  run_right_d: THREE.AnimationAction | null;
  run_backward_left_d: THREE.AnimationAction | null;
  run_backward_right_d: THREE.AnimationAction | null;
  jump_up: THREE.AnimationAction | null;
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
  backwards_left_d?: THREE.AnimationClip | null;
  backwards_right_d?: THREE.AnimationClip | null;
  left?: THREE.AnimationClip | null;
  right?: THREE.AnimationClip | null;
  idle_crouch?: THREE.AnimationClip | null;
  walk_crouch?: THREE.AnimationClip | null;
  walk_crouch_left_d?: THREE.AnimationClip | null;
  walk_crouch_right_d?: THREE.AnimationClip | null;
  backwards_crouch?: THREE.AnimationClip | null;
  backwards_crouch_left_d?: THREE.AnimationClip | null;
  backwards_crouch_right_d?: THREE.AnimationClip | null;
  left_crouch?: THREE.AnimationClip | null;
  right_crouch?: THREE.AnimationClip | null;
  run_forward?: THREE.AnimationClip | null;
  run_backward?: THREE.AnimationClip | null;
  run_left?: THREE.AnimationClip | null;
  run_right?: THREE.AnimationClip | null;
  run_left_d?: THREE.AnimationClip | null;
  run_right_d?: THREE.AnimationClip | null;
  run_backward_left_d?: THREE.AnimationClip | null;
  run_backward_right_d?: THREE.AnimationClip | null;
  jump_up?: THREE.AnimationClip | null;
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
    case 'backwards_left_d':
      return actions.backwards_left_d ?? actions.backwards ?? actions.walk;
    case 'backwards_right_d':
      return actions.backwards_right_d ?? actions.backwards ?? actions.walk;
    case 'left':
      return actions.left ?? actions.walk;
    case 'right':
      return actions.right ?? actions.walk;
    case 'idle_crouch':
      return actions.idle_crouch ?? actions.idle;
    case 'walk_crouch':
      return actions.walk_crouch ?? actions.walk;
    case 'walk_crouch_left_d':
      return actions.walk_crouch_left_d ?? actions.walk_crouch ?? actions.walk_left_d ?? actions.walk;
    case 'walk_crouch_right_d':
      return actions.walk_crouch_right_d ?? actions.walk_crouch ?? actions.walk_right_d ?? actions.walk;
    case 'backwards_crouch':
      return actions.backwards_crouch ?? actions.backwards ?? actions.walk;
    case 'backwards_crouch_left_d':
      return (
        actions.backwards_crouch_left_d
        ?? actions.backwards_crouch
        ?? actions.backwards_left_d
        ?? actions.backwards
        ?? actions.walk
      );
    case 'backwards_crouch_right_d':
      return (
        actions.backwards_crouch_right_d
        ?? actions.backwards_crouch
        ?? actions.backwards_right_d
        ?? actions.backwards
        ?? actions.walk
      );
    case 'left_crouch':
      return actions.left_crouch ?? actions.left ?? actions.walk_crouch ?? actions.walk;
    case 'right_crouch':
      return actions.right_crouch ?? actions.right ?? actions.walk_crouch ?? actions.walk;
    case 'run_forward':
      return actions.run_forward ?? actions.walk;
    case 'run_backward':
      return actions.run_backward ?? actions.backwards ?? actions.run_forward ?? actions.walk;
    case 'run_left':
      return actions.run_left ?? actions.left ?? actions.run_forward ?? actions.walk;
    case 'run_right':
      return actions.run_right ?? actions.right ?? actions.run_forward ?? actions.walk;
    case 'run_left_d':
      return actions.run_left_d ?? actions.run_forward ?? actions.walk_left_d ?? actions.walk;
    case 'run_right_d':
      return actions.run_right_d ?? actions.run_forward ?? actions.walk_right_d ?? actions.walk;
    case 'run_backward_left_d':
      return (
        actions.run_backward_left_d
        ?? actions.run_backward
        ?? actions.backwards_left_d
        ?? actions.backwards
        ?? actions.run_forward
        ?? actions.walk
      );
    case 'run_backward_right_d':
      return (
        actions.run_backward_right_d
        ?? actions.run_backward
        ?? actions.backwards_right_d
        ?? actions.backwards
        ?? actions.run_forward
        ?? actions.walk
      );
    case 'jump_up':
      return actions.jump_up ?? actions.idle;
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
  const jumpUp = makeAction(mixer, clips.jump_up ?? null);
  if (jumpUp) {
    jumpUp.setLoop(THREE.LoopOnce, 1);
    jumpUp.clampWhenFinished = true;
  }
  return {
    mixer,
    actionByLocomotion: {
      idle: idleAction,
      walk: walkAction,
      walk_left_d: makeAction(mixer, clips.walk_left_d ?? null),
      walk_right_d: makeAction(mixer, clips.walk_right_d ?? null),
      backwards: makeAction(mixer, clips.backwards ?? null),
      backwards_left_d: makeAction(mixer, clips.backwards_left_d ?? null),
      backwards_right_d: makeAction(mixer, clips.backwards_right_d ?? null),
      left: makeAction(mixer, clips.left ?? null),
      right: makeAction(mixer, clips.right ?? null),
      idle_crouch: makeAction(mixer, clips.idle_crouch ?? null),
      walk_crouch: makeAction(mixer, clips.walk_crouch ?? null),
      walk_crouch_left_d: makeAction(mixer, clips.walk_crouch_left_d ?? null),
      walk_crouch_right_d: makeAction(mixer, clips.walk_crouch_right_d ?? null),
      backwards_crouch: makeAction(mixer, clips.backwards_crouch ?? null),
      backwards_crouch_left_d: makeAction(mixer, clips.backwards_crouch_left_d ?? null),
      backwards_crouch_right_d: makeAction(mixer, clips.backwards_crouch_right_d ?? null),
      left_crouch: makeAction(mixer, clips.left_crouch ?? null),
      right_crouch: makeAction(mixer, clips.right_crouch ?? null),
      run_forward: makeAction(mixer, clips.run_forward ?? null),
      run_backward: makeAction(mixer, clips.run_backward ?? null),
      run_left: makeAction(mixer, clips.run_left ?? null),
      run_right: makeAction(mixer, clips.run_right ?? null),
      run_left_d: makeAction(mixer, clips.run_left_d ?? null),
      run_right_d: makeAction(mixer, clips.run_right_d ?? null),
      run_backward_left_d: makeAction(mixer, clips.run_backward_left_d ?? null),
      run_backward_right_d: makeAction(mixer, clips.run_backward_right_d ?? null),
      jump_up: jumpUp,
    },
    current: 'idle',
  };
}
