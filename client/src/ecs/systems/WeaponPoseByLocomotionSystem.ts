import type { World } from 'miniplex'
import type * as THREE from 'three'
import type { PlayerController, WeaponState } from '../components'
import type { PlayerAnimation } from '../components/PlayerAnimation'
import { hasAnimationActionForLocomotion } from '../components/PlayerAnimation'
import { toBaseLocomotionFromFire } from '../../game/player/playerLocomotionLogic'
import { resolveWeaponAnimationPoseKey } from '../../config/weapons/types'
import {
  getWeaponFpPoseForAnimation,
  getWeaponPoseForLocomotion,
  resolveWeaponId,
} from '../../game/weapon/supportedWeaponModels'
import { applyWeaponTransformValues } from '../../game/weapon/weaponVisualAttach'

export function createWeaponPoseByLocomotionSystem(world: World) {
  const appliedKeyByEntity = new WeakMap<object, string>()
  const appliedVisualByEntity = new WeakMap<object, object>()
  const appliedFpKeyByEntity = new WeakMap<object, string>()
  const appliedFpVisualByEntity = new WeakMap<object, object>()

  return (_deltaTime: number) => {
    for (const entity of world.with('playerController', 'weaponState')) {
      const weaponVisualObject = (entity as { weaponVisualObject?: THREE.Object3D | null }).weaponVisualObject
      const weaponVisualFpObject = (entity as { weaponVisualFpObject?: THREE.Object3D | null }).weaponVisualFpObject
      const playerController = entity.playerController as PlayerController
      const playerAnimation = (entity as { playerAnimation?: PlayerAnimation }).playerAnimation
      const weaponState = entity.weaponState as WeaponState
      const weaponId = resolveWeaponId(weaponState.weaponId)
      const locomotion = playerController.locomotion

      if (weaponVisualFpObject) {
        const previousFpVisual = appliedFpVisualByEntity.get(entity)
        if (previousFpVisual !== weaponVisualFpObject) {
          appliedFpKeyByEntity.delete(entity)
          appliedFpVisualByEntity.set(entity, weaponVisualFpObject)
        }
        const fpPoseKey = resolveWeaponAnimationPoseKey(locomotion, weaponState.action)
        const fpCacheKey = `${weaponId}:${fpPoseKey}`
        if (appliedFpKeyByEntity.get(entity) !== fpCacheKey) {
          const fpPose = getWeaponFpPoseForAnimation(weaponId, fpPoseKey)
          applyWeaponTransformValues(weaponVisualFpObject, fpPose)
          appliedFpKeyByEntity.set(entity, fpCacheKey)
        }
      }

      if (!weaponVisualObject || weaponVisualFpObject === weaponVisualObject) {
        continue
      }
      const previousVisual = appliedVisualByEntity.get(entity)
      if (previousVisual !== weaponVisualObject) {
        appliedKeyByEntity.delete(entity)
        appliedVisualByEntity.set(entity, weaponVisualObject)
      }
      const hasFireAnimation = !locomotion.includes('fire')
        || !!playerAnimation && hasAnimationActionForLocomotion(playerAnimation.actionByLocomotion, locomotion)
      const locomotionForPose = hasFireAnimation
        ? locomotion
        : toBaseLocomotionFromFire(locomotion)
      const cacheKey = `${weaponId}:${locomotionForPose}`
      if (appliedKeyByEntity.get(entity) === cacheKey) continue
      const pose = getWeaponPoseForLocomotion(weaponId, locomotionForPose)
      applyWeaponTransformValues(weaponVisualObject, pose)
      appliedKeyByEntity.set(entity, cacheKey)
    }
  }
}
