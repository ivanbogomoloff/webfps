import { World } from 'miniplex';
import * as CANNON from 'cannon-es';

export function createPhysicsSystem(world: World, physicsWorld: CANNON.World) {
  return (deltaTime: number) => {
    // Обновляем физический мир
    physicsWorld.fixedStep(1 / 60, deltaTime); // Шаг физики с фиксированным временем
  };
}
