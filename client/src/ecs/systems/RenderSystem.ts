import { World } from 'miniplex';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function createRenderSystem(world: World, _scene: THREE.Scene) {
  return (_deltaTime: number) => {
    for (const entity of world.with('physicBody', 'object3d')) {

      const { object3d, physicBody } = entity;

      if(physicBody.type === CANNON.Body.STATIC) {
        continue; // Пропускаем статические объекты, так как они не двигаются
      }

      object3d.position.copy(new THREE.Vector3(
        physicBody.position.x,
        physicBody.position.y,
        physicBody.position.z
      ));
      object3d.quaternion.copy(new THREE.Quaternion(
        physicBody.quaternion.x,
        physicBody.quaternion.y,
        physicBody.quaternion.z,
        physicBody.quaternion.w
      ));
    }
  };
}
