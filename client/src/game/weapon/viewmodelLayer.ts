import type * as THREE from 'three'

export const WORLD_RENDER_LAYER = 0
export const FP_VIEWMODEL_RENDER_LAYER = 1

export function assignObjectToLayerRecursive(object: THREE.Object3D, layer: number): void {
  object.traverse((node) => {
    node.layers.set(layer)
  })
}

export function renderSceneWithFpViewmodelPass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): void {
  const previousMask = camera.layers.mask
  const previousAutoClear = renderer.autoClear

  camera.layers.mask = previousMask & ~(1 << FP_VIEWMODEL_RENDER_LAYER)
  renderer.autoClear = true
  renderer.render(scene, camera)

  renderer.autoClear = false
  renderer.clearDepth()
  const previousBackground = scene.background
  scene.background = null
  camera.layers.mask = 1 << FP_VIEWMODEL_RENDER_LAYER
  renderer.render(scene, camera)
  scene.background = previousBackground

  camera.layers.mask = previousMask
  renderer.autoClear = previousAutoClear
}
