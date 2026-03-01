import { World } from 'miniplex';
import * as THREE from 'three';

export function createRenderSystem(world: World, _scene: THREE.Scene) {
  return (_deltaTime: number) => {
    for (const entity of world.with('transform', 'mesh')) {
      const transform = entity.transform as any;
      const mesh = entity.mesh as any;

      // Синхронизируем позицию и ротацию с Three.js объектом
      mesh.object3d.position.copy(transform.position);
      mesh.object3d.rotation.copy(transform.rotation);
      mesh.object3d.scale.copy(transform.scale);
    }
  };
}
