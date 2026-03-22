import { World } from 'miniplex';
import * as CANNON from 'cannon-es';

export function createPhysicsSystem(_world: World, physicsWorld: CANNON.World) {
  return (_deltaTime: number) => {
    // Обновляем физический мир
    physicsWorld.fixedStep(); // Шаг физики с фиксированным временем
  };
}
