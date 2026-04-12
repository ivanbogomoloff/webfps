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
  fire: THREE.AnimationAction | null;
  walk_fire: THREE.AnimationAction | null;
  walk_left_d_fire: THREE.AnimationAction | null;
  walk_right_d_fire: THREE.AnimationAction | null;
  backwards_fire: THREE.AnimationAction | null;
  backwards_left_d_fire: THREE.AnimationAction | null;
  backwards_right_d_fire: THREE.AnimationAction | null;
  left_fire: THREE.AnimationAction | null;
  right_fire: THREE.AnimationAction | null;
  idle_crouch_fire: THREE.AnimationAction | null;
  walk_crouch_fire: THREE.AnimationAction | null;
  walk_crouch_left_d_fire: THREE.AnimationAction | null;
  walk_crouch_right_d_fire: THREE.AnimationAction | null;
  backwards_crouch_fire: THREE.AnimationAction | null;
  backwards_crouch_left_d_fire: THREE.AnimationAction | null;
  backwards_crouch_right_d_fire: THREE.AnimationAction | null;
  left_crouch_fire: THREE.AnimationAction | null;
  right_crouch_fire: THREE.AnimationAction | null;
  run_forward_fire: THREE.AnimationAction | null;
  run_backward_fire: THREE.AnimationAction | null;
  run_left_fire: THREE.AnimationAction | null;
  run_right_fire: THREE.AnimationAction | null;
  run_left_d_fire: THREE.AnimationAction | null;
  run_right_d_fire: THREE.AnimationAction | null;
  run_backward_left_d_fire: THREE.AnimationAction | null;
  run_backward_right_d_fire: THREE.AnimationAction | null;
  jump_up: THREE.AnimationAction | null;
  death_back: THREE.AnimationAction | null;
  death_crouch: THREE.AnimationAction | null;
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
  fire?: THREE.AnimationClip | null;
  walk_fire?: THREE.AnimationClip | null;
  walk_left_d_fire?: THREE.AnimationClip | null;
  walk_right_d_fire?: THREE.AnimationClip | null;
  backwards_fire?: THREE.AnimationClip | null;
  backwards_left_d_fire?: THREE.AnimationClip | null;
  backwards_right_d_fire?: THREE.AnimationClip | null;
  left_fire?: THREE.AnimationClip | null;
  right_fire?: THREE.AnimationClip | null;
  idle_crouch_fire?: THREE.AnimationClip | null;
  walk_crouch_fire?: THREE.AnimationClip | null;
  walk_crouch_left_d_fire?: THREE.AnimationClip | null;
  walk_crouch_right_d_fire?: THREE.AnimationClip | null;
  backwards_crouch_fire?: THREE.AnimationClip | null;
  backwards_crouch_left_d_fire?: THREE.AnimationClip | null;
  backwards_crouch_right_d_fire?: THREE.AnimationClip | null;
  left_crouch_fire?: THREE.AnimationClip | null;
  right_crouch_fire?: THREE.AnimationClip | null;
  run_forward_fire?: THREE.AnimationClip | null;
  run_backward_fire?: THREE.AnimationClip | null;
  run_left_fire?: THREE.AnimationClip | null;
  run_right_fire?: THREE.AnimationClip | null;
  run_left_d_fire?: THREE.AnimationClip | null;
  run_right_d_fire?: THREE.AnimationClip | null;
  run_backward_left_d_fire?: THREE.AnimationClip | null;
  run_backward_right_d_fire?: THREE.AnimationClip | null;
  jump_up?: THREE.AnimationClip | null;
  death_back?: THREE.AnimationClip | null;
  death_crouch?: THREE.AnimationClip | null;
};

function makeAction(
  mixer: THREE.AnimationMixer,
  clip: THREE.AnimationClip | null | undefined,
): THREE.AnimationAction | null {
  if (!clip) return null;
  return mixer.clipAction(clip);
}

function exactActionForLocomotion(
  actions: PlayerAnimationActions,
  locomotion: PlayerLocomotion,
): THREE.AnimationAction | null {
  const action = actions[locomotion as keyof PlayerAnimationActions];
  return action ?? null;
}

export function hasAnimationActionForLocomotion(
  actions: PlayerAnimationActions,
  locomotion: PlayerLocomotion,
): boolean {
  return exactActionForLocomotion(actions, locomotion) !== null;
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
    case 'fire':
      return actions.fire ?? actions.idle;
    case 'walk_fire':
      return actions.walk_fire ?? actions.walk;
    case 'walk_left_d_fire':
      return actions.walk_left_d_fire ?? actions.walk_left_d ?? actions.walk;
    case 'walk_right_d_fire':
      return actions.walk_right_d_fire ?? actions.walk_right_d ?? actions.walk;
    case 'backwards_fire':
      return actions.backwards_fire ?? actions.backwards ?? actions.walk;
    case 'backwards_left_d_fire':
      return actions.backwards_left_d_fire ?? actions.backwards_left_d ?? actions.backwards ?? actions.walk;
    case 'backwards_right_d_fire':
      return actions.backwards_right_d_fire ?? actions.backwards_right_d ?? actions.backwards ?? actions.walk;
    case 'left_fire':
      return actions.left_fire ?? actions.left ?? actions.walk;
    case 'right_fire':
      return actions.right_fire ?? actions.right ?? actions.walk;
    case 'idle_crouch_fire':
      return actions.idle_crouch_fire ?? actions.idle_crouch ?? actions.idle;
    case 'walk_crouch_fire':
      return actions.walk_crouch_fire ?? actions.walk_crouch ?? actions.walk;
    case 'walk_crouch_left_d_fire':
      return actions.walk_crouch_left_d_fire ?? actions.walk_crouch_left_d ?? actions.walk_crouch ?? actions.walk_left_d ?? actions.walk;
    case 'walk_crouch_right_d_fire':
      return actions.walk_crouch_right_d_fire ?? actions.walk_crouch_right_d ?? actions.walk_crouch ?? actions.walk_right_d ?? actions.walk;
    case 'backwards_crouch_fire':
      return actions.backwards_crouch_fire ?? actions.backwards_crouch ?? actions.backwards ?? actions.walk;
    case 'backwards_crouch_left_d_fire':
      return (
        actions.backwards_crouch_left_d_fire
        ?? actions.backwards_crouch_left_d
        ?? actions.backwards_crouch
        ?? actions.backwards_left_d
        ?? actions.backwards
        ?? actions.walk
      );
    case 'backwards_crouch_right_d_fire':
      return (
        actions.backwards_crouch_right_d_fire
        ?? actions.backwards_crouch_right_d
        ?? actions.backwards_crouch
        ?? actions.backwards_right_d
        ?? actions.backwards
        ?? actions.walk
      );
    case 'left_crouch_fire':
      return actions.left_crouch_fire ?? actions.left_crouch ?? actions.left ?? actions.walk_crouch ?? actions.walk;
    case 'right_crouch_fire':
      return actions.right_crouch_fire ?? actions.right_crouch ?? actions.right ?? actions.walk_crouch ?? actions.walk;
    case 'run_forward_fire':
      return actions.run_forward_fire ?? actions.run_forward ?? actions.walk;
    case 'run_backward_fire':
      return actions.run_backward_fire ?? actions.run_backward ?? actions.backwards ?? actions.run_forward ?? actions.walk;
    case 'run_left_fire':
      return actions.run_left_fire ?? actions.run_left ?? actions.left ?? actions.run_forward ?? actions.walk;
    case 'run_right_fire':
      return actions.run_right_fire ?? actions.run_right ?? actions.right ?? actions.run_forward ?? actions.walk;
    case 'run_left_d_fire':
      return actions.run_left_d_fire ?? actions.run_left_d ?? actions.run_forward ?? actions.walk_left_d ?? actions.walk;
    case 'run_right_d_fire':
      return actions.run_right_d_fire ?? actions.run_right_d ?? actions.run_forward ?? actions.walk_right_d ?? actions.walk;
    case 'run_backward_left_d_fire':
      return (
        actions.run_backward_left_d_fire
        ?? actions.run_backward_left_d
        ?? actions.run_backward
        ?? actions.backwards_left_d
        ?? actions.backwards
        ?? actions.run_forward
        ?? actions.walk
      );
    case 'run_backward_right_d_fire':
      return (
        actions.run_backward_right_d_fire
        ?? actions.run_backward_right_d
        ?? actions.run_backward
        ?? actions.backwards_right_d
        ?? actions.backwards
        ?? actions.run_forward
        ?? actions.walk
      );
    case 'jump_up':
      return actions.jump_up ?? actions.idle;
    case 'death_back':
      return actions.death_back ?? actions.idle;
    case 'death_crouch':
      return actions.death_crouch ?? actions.death_back ?? actions.idle_crouch ?? actions.idle;
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
      fire: makeAction(mixer, clips.fire ?? null),
      walk_fire: makeAction(mixer, clips.walk_fire ?? null),
      walk_left_d_fire: makeAction(mixer, clips.walk_left_d_fire ?? null),
      walk_right_d_fire: makeAction(mixer, clips.walk_right_d_fire ?? null),
      backwards_fire: makeAction(mixer, clips.backwards_fire ?? null),
      backwards_left_d_fire: makeAction(mixer, clips.backwards_left_d_fire ?? null),
      backwards_right_d_fire: makeAction(mixer, clips.backwards_right_d_fire ?? null),
      left_fire: makeAction(mixer, clips.left_fire ?? null),
      right_fire: makeAction(mixer, clips.right_fire ?? null),
      idle_crouch_fire: makeAction(mixer, clips.idle_crouch_fire ?? null),
      walk_crouch_fire: makeAction(mixer, clips.walk_crouch_fire ?? null),
      walk_crouch_left_d_fire: makeAction(mixer, clips.walk_crouch_left_d_fire ?? null),
      walk_crouch_right_d_fire: makeAction(mixer, clips.walk_crouch_right_d_fire ?? null),
      backwards_crouch_fire: makeAction(mixer, clips.backwards_crouch_fire ?? null),
      backwards_crouch_left_d_fire: makeAction(mixer, clips.backwards_crouch_left_d_fire ?? null),
      backwards_crouch_right_d_fire: makeAction(mixer, clips.backwards_crouch_right_d_fire ?? null),
      left_crouch_fire: makeAction(mixer, clips.left_crouch_fire ?? null),
      right_crouch_fire: makeAction(mixer, clips.right_crouch_fire ?? null),
      run_forward_fire: makeAction(mixer, clips.run_forward_fire ?? null),
      run_backward_fire: makeAction(mixer, clips.run_backward_fire ?? null),
      run_left_fire: makeAction(mixer, clips.run_left_fire ?? null),
      run_right_fire: makeAction(mixer, clips.run_right_fire ?? null),
      run_left_d_fire: makeAction(mixer, clips.run_left_d_fire ?? null),
      run_right_d_fire: makeAction(mixer, clips.run_right_d_fire ?? null),
      run_backward_left_d_fire: makeAction(mixer, clips.run_backward_left_d_fire ?? null),
      run_backward_right_d_fire: makeAction(mixer, clips.run_backward_right_d_fire ?? null),
      jump_up: jumpUp,
      death_back: makeAction(mixer, clips.death_back ?? null),
      death_crouch: makeAction(mixer, clips.death_crouch ?? null),
    },
    current: 'idle',
  };
}
