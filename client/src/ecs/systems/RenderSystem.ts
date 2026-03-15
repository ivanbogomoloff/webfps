import { World } from 'miniplex';
import * as THREE from 'three';

// При использовании AmmoPhysics меши обновляются самим движком,
// поэтому здесь ничего синхронизировать не нужно.
export function createRenderSystem(_world: World, _scene: THREE.Scene) {
  return (_deltaTime: number) => {};
}
