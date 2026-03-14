import * as CANNON from 'cannon-es';

export function createPhysicBody(
  position: CANNON.Vec3,
  shape: CANNON.Shape,
  mass: number = 1,
  type: CANNON.BodyType = CANNON.Body.DYNAMIC
): CANNON.Body {
  return new CANNON.Body({
    position, // Позиция тела
    mass, // Масса тела
    shape, // Форма тела
    type, // Тип тела (кинематическое или динамическое)
  });
}
