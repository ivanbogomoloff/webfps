import { World } from 'miniplex';
import * as THREE from 'three';
import type { PlayerAnimation } from '../components/PlayerAnimation';
import {
  pickAnimationAction,
  PLAYER_ANIMATION_FADE_DURATION,
} from '../components/PlayerAnimation';
import type { PlayerController, PlayerLocomotion } from '../components/PlayerController';

const FADE = PLAYER_ANIMATION_FADE_DURATION;
/** Порог скорости по интерполированной позиции (м/с), чтобы переключить удалённого игрока walk/idle. */
const REMOTE_WALK_SPEED_THRESHOLD = 0.2;

type RemoteAnimPrev = { x: number; z: number; t: number };

export function createPlayerAnimationSystem(world: World) {
  return (deltaTime: number) => {
    for (const entity of world.with('playerAnimation', 'playerController', 'object3d')) {
      const pa = entity.playerAnimation as PlayerAnimation;
      const controller = entity.playerController as PlayerController;
      const networkIdentity = (entity as any).networkIdentity as
        | { isLocal?: boolean }
        | undefined;

      pa.mixer.update(deltaTime);

      let nextLoc: PlayerLocomotion;
      if (networkIdentity && !networkIdentity.isLocal) {
        const obj = entity.object3d as THREE.Object3D;
        const nowMs = performance.now();
        const prev = (entity as any)._remoteAnimPrev as RemoteAnimPrev | undefined;
        if (!prev) {
          (entity as any)._remoteAnimPrev = { x: obj.position.x, z: obj.position.z, t: nowMs };
          nextLoc = 'idle';
        } else {
          const dtSec = (nowMs - prev.t) / 1000;
          const dx = obj.position.x - prev.x;
          const dz = obj.position.z - prev.z;
          const speed = dtSec > 1e-4 ? Math.hypot(dx, dz) / dtSec : 0;
          (entity as any)._remoteAnimPrev = { x: obj.position.x, z: obj.position.z, t: nowMs };
          nextLoc = speed > REMOTE_WALK_SPEED_THRESHOLD ? 'walk' : 'idle';
        }
      } else {
        nextLoc = controller.locomotion;
      }

      if (nextLoc === pa.current) continue;

      const prevAction = pickAnimationAction(pa.actionByLocomotion, pa.current);
      const nextAction = pickAnimationAction(pa.actionByLocomotion, nextLoc);

      if (prevAction !== nextAction) {
        prevAction.fadeOut(FADE);
        nextAction.reset().fadeIn(FADE).play();
      }

      pa.current = nextLoc;
    }
  };
}
