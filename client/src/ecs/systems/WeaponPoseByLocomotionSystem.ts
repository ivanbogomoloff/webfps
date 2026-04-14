import type { World } from 'miniplex'
import type { PlayerController, WeaponState } from '../components'
import type { PlayerAnimation } from '../components/PlayerAnimation'
import { hasAnimationActionForLocomotion } from '../components/PlayerAnimation'
import { toBaseLocomotionFromFire } from '../../game/player/playerLocomotionLogic'
import { getWeaponPoseForLocomotion, resolveWeaponId } from '../../game/weapon/supportedWeaponModels'
import { applyWeaponTransformValues } from '../../game/weapon/weaponVisualAttach'

export function createWeaponPoseByLocomotionSystem(world: World) {
  const appliedKeyByEntity = new WeakMap<object, string>()
  const appliedVisualByEntity = new WeakMap<object, object>()

  return (_deltaTime: number) => {
    for (const entity of world.with('playerController', 'weaponState', 'weaponVisualObject')) {
      const weaponVisualObject = entity.weaponVisualObject
      if (!weaponVisualObject) continue
      const previousVisual = appliedVisualByEntity.get(entity)
      if (previousVisual !== weaponVisualObject) {
        appliedKeyByEntity.delete(entity)
        appliedVisualByEntity.set(entity, weaponVisualObject)
      }
      const playerController = entity.playerController as PlayerController
      const playerAnimation = (entity as { playerAnimation?: PlayerAnimation }).playerAnimation
      const weaponState = entity.weaponState as WeaponState
      const weaponId = resolveWeaponId(weaponState.weaponId)
      const locomotion = playerController.locomotion
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
