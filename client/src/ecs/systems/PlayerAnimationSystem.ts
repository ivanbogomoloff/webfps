import { World } from 'miniplex';
import type { PlayerAnimation } from '../components/PlayerAnimation';
import type { PlayerController } from '../components/PlayerController';

const FADE = 0.2;

export function createPlayerAnimationSystem(world: World) {
  return (deltaTime: number) => {
    for (const entity of world.with('playerAnimation', 'playerController')) {
      const pa = entity.playerAnimation as PlayerAnimation;
      const controller = entity.playerController as PlayerController;

      pa.mixer.update(deltaTime);

      const wantWalk = controller.isMoving;
      if (wantWalk && pa.current !== 'walk') {
        pa.current = 'walk';
        pa.idleAction.fadeOut(FADE);
        pa.walkAction.reset().fadeIn(FADE).play();
      } else if (!wantWalk && pa.current !== 'idle') {
        pa.current = 'idle';
        pa.walkAction.fadeOut(FADE);
        pa.idleAction.reset().fadeIn(FADE).play();
      }
    }
  };
}
