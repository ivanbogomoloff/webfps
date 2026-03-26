import { World } from 'miniplex';
import type { PlayerAnimation } from '../components/PlayerAnimation';
import {
  pickAnimationAction,
  PLAYER_ANIMATION_FADE_DURATION,
} from '../components/PlayerAnimation';
import type { PlayerController, PlayerLocomotion } from '../components/PlayerController';

const FADE = PLAYER_ANIMATION_FADE_DURATION;

export function createPlayerAnimationSystem(world: World) {
  return (deltaTime: number) => {
    for (const entity of world.with('playerAnimation', 'playerController')) {
      const pa = entity.playerAnimation as PlayerAnimation;
      const controller = entity.playerController as PlayerController;

      pa.mixer.update(deltaTime);

      const nextLoc: PlayerLocomotion = controller.locomotion;
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
