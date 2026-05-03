import type { World } from 'miniplex'
import * as THREE from 'three'
import type { AmmoPhysicsContext } from './PhysicsSystem'
import { consumeLocalShotImpactEvents } from './ShotImpactEvents'

const IMPACT_TTL_MS = 5000
const IMPACT_FLASH_TTL_MS = 180
const MAX_ACTIVE_IMPACTS = 200
const SHOT_MAX_DISTANCE = 120
const SURFACE_OFFSET = 0.008

type ActiveImpact = {
  markMesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
  flashMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  createdAtMs: number
  expiresAtMs: number
}

const markGeometry = new THREE.CircleGeometry(0.05, 10)
const markMaterialTemplate = new THREE.MeshBasicMaterial({
  color: 0x2c2c2c,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
})
const flashGeometry = new THREE.SphereGeometry(0.045, 8, 8)
const flashMaterialTemplate = new THREE.MeshBasicMaterial({
  color: 0xffcf7a,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})

const direction = new THREE.Vector3()
const hitPoint = new THREE.Vector3()
const hitNormal = new THREE.Vector3()
const toVector = new THREE.Vector3()
const quaternion = new THREE.Quaternion()
const circleForward = new THREE.Vector3(0, 0, 1)
const rayFromWorld = new THREE.Vector3()
const rayToWorld = new THREE.Vector3()

export function createWorldImpactSystem(
  _world: World,
  options: {
    scene: THREE.Scene
    physicsContext: AmmoPhysicsContext
  },
) {
  const activeImpacts: ActiveImpact[] = []

  return (_deltaTime: number) => {
    const now = performance.now()
    for (let i = activeImpacts.length - 1; i >= 0; i -= 1) {
      const impact = activeImpacts[i]
      const lifeMs = impact.expiresAtMs - now
      if (lifeMs <= 0) {
        options.scene.remove(impact.markMesh)
        options.scene.remove(impact.flashMesh)
        impact.markMesh.material.dispose()
        impact.flashMesh.material.dispose()
        activeImpacts.splice(i, 1)
        continue
      }

      const lifeAlpha = Math.max(0, lifeMs / IMPACT_TTL_MS)
      impact.markMesh.material.opacity = 0.2 + lifeAlpha * 0.75

      const flashLifeMs = Math.max(0, IMPACT_FLASH_TTL_MS - (now - impact.createdAtMs))
      const flashAlpha = flashLifeMs / IMPACT_FLASH_TTL_MS
      impact.flashMesh.visible = flashLifeMs > 0
      if (impact.flashMesh.visible) {
        impact.flashMesh.material.opacity = flashAlpha * 0.85
        impact.flashMesh.scale.setScalar(0.6 + (1 - flashAlpha) * 0.9)
      }
    }

    const { ammo, physicsWorld } = options.physicsContext
    if (!ammo || !physicsWorld) return

    const shotEvents = consumeLocalShotImpactEvents()
    if (shotEvents.length === 0) return

    for (const shotEvent of shotEvents) {
      direction.set(
        shotEvent.direction.x,
        shotEvent.direction.y,
        shotEvent.direction.z,
      )
      if (direction.lengthSq() <= 1e-6) continue
      direction.normalize()
      rayFromWorld.set(
        shotEvent.origin.x,
        shotEvent.origin.y,
        shotEvent.origin.z,
      )
      rayToWorld.copy(rayFromWorld).addScaledVector(direction, SHOT_MAX_DISTANCE)

      const rayFrom = new ammo.btVector3(rayFromWorld.x, rayFromWorld.y, rayFromWorld.z)
      const rayTo = new ammo.btVector3(rayToWorld.x, rayToWorld.y, rayToWorld.z)
      const callback = new ammo.ClosestRayResultCallback(rayFrom, rayTo)
      callback.set_m_closestHitFraction(1)
      callback.set_m_rayFromWorld(rayFrom)
      callback.set_m_rayToWorld(rayTo)
      physicsWorld.rayTest(rayFrom, rayTo, callback)

      const hasHit = callback.hasHit()
      if (!hasHit) {
        ammo.destroy(callback)
        ammo.destroy(rayFrom)
        ammo.destroy(rayTo)
        continue
      }

      const pointVec = callback.get_m_hitPointWorld?.()
      if (pointVec) {
        hitPoint.set(pointVec.x(), pointVec.y(), pointVec.z())
      } else {
        const hitFraction = callback.get_m_closestHitFraction?.() ?? 1
        hitPoint.copy(rayFromWorld).lerp(rayToWorld, Math.max(0, Math.min(1, hitFraction)))
      }

      const normalVec = callback.get_m_hitNormalWorld?.()
      if (normalVec) {
        hitNormal.set(normalVec.x(), normalVec.y(), normalVec.z()).normalize()
      } else {
        hitNormal.copy(direction).multiplyScalar(-1).normalize()
      }
      if (hitNormal.lengthSq() <= 1e-6) {
        hitNormal.set(0, 1, 0)
      }

      const markMesh = new THREE.Mesh(markGeometry, markMaterialTemplate.clone())
      quaternion.setFromUnitVectors(circleForward, hitNormal)
      markMesh.quaternion.copy(quaternion)
      markMesh.position.copy(hitPoint).addScaledVector(hitNormal, SURFACE_OFFSET)
      markMesh.renderOrder = 12

      const flashMesh = new THREE.Mesh(flashGeometry, flashMaterialTemplate.clone())
      flashMesh.position.copy(hitPoint).addScaledVector(hitNormal, SURFACE_OFFSET * 2)
      toVector.copy(hitPoint).add(hitNormal)
      flashMesh.lookAt(toVector)
      flashMesh.renderOrder = 11

      options.scene.add(markMesh)
      options.scene.add(flashMesh)
      activeImpacts.push({
        markMesh: markMesh as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>,
        flashMesh: flashMesh as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>,
        createdAtMs: now,
        expiresAtMs: now + IMPACT_TTL_MS,
      })
      while (activeImpacts.length > MAX_ACTIVE_IMPACTS) {
        const oldest = activeImpacts.shift()
        if (!oldest) break
        options.scene.remove(oldest.markMesh)
        options.scene.remove(oldest.flashMesh)
        oldest.markMesh.material.dispose()
        oldest.flashMesh.material.dispose()
      }

      ammo.destroy(callback)
      ammo.destroy(rayFrom)
      ammo.destroy(rayTo)
    }
  }
}
