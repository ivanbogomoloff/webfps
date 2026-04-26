import type * as THREE from 'three'

export const WORLD_RENDER_LAYER = 0
export const FP_VIEWMODEL_RENDER_LAYER = 1

export function assignObjectToLayerRecursive(object: THREE.Object3D, layer: number): void {
  object.traverse((node) => {
    node.layers.set(layer)
  })
}
