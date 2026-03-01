import { World } from 'miniplex';

const GRAVITY = -9.81;

export function createPhysicsSystem(world: World) {
  return (deltaTime: number) => {
    for (const entity of world.with('rigidBody', 'transform')) {
      const rigidBody = entity.rigidBody as any;
      const transform = entity.transform as any;

      if (rigidBody.isKinematic) continue;

      // Применяем гравитацию
      rigidBody.acceleration.y = GRAVITY;

      // Обновляем скорость
      rigidBody.velocity.addScaledVector(rigidBody.acceleration, deltaTime);

      // Обновляем позицию
      transform.position.addScaledVector(rigidBody.velocity, deltaTime);
    }
  };
}
