import type { World } from 'miniplex'
import type { PlayerController, WeaponState } from '../components'
import { getWeaponPoseForLocomotion, resolveWeaponId } from '../../game/supportedWeaponModels'
import { applyWeaponTransformValues } from '../../game/weaponVisualAttach'

export function createWeaponPoseByLocomotionSystem(world: World) {
  const appliedKeyByEntity = new WeakMap<object, string>()

  return (_deltaTime: number) => {
    for (const entity of world.with('playerController', 'weaponState', 'weaponVisualObject')) {
      const weaponVisualObject = entity.weaponVisualObject
      if (!weaponVisualObject) continue
      const playerController = entity.playerController as PlayerController
      const weaponState = entity.weaponState as WeaponState
      const weaponId = resolveWeaponId(weaponState.weaponId)
      const locomotion = playerController.locomotion
      const cacheKey = `${weaponId}:${locomotion}`
      if (appliedKeyByEntity.get(entity) === cacheKey) continue
      const pose = getWeaponPoseForLocomotion(weaponId, locomotion)
      applyWeaponTransformValues(weaponVisualObject, pose)
      appliedKeyByEntity.set(entity, cacheKey)
    }
  }
}
