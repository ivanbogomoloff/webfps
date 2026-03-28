import type { World } from 'miniplex'
import * as THREE from 'three'

const tmpTarget = new THREE.Vector3()

export function createRemoteInterpolationSystem(world: World) {
  return (deltaTime: number) => {
    const alpha = Math.min(1, deltaTime * 10)
    for (const entity of world.with('networkIdentity', 'networkTransform', 'object3d')) {
      if ((entity.networkIdentity as any).isLocal) continue

      const transform = entity.networkTransform as any
      const object3d = entity.object3d as THREE.Object3D
      tmpTarget.set(transform.x, transform.y, transform.z)
      object3d.position.lerp(tmpTarget, alpha)
      object3d.rotation.y += (transform.rotY - object3d.rotation.y) * alpha
    }
  }
}
