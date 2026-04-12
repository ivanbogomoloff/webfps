import type { World } from 'miniplex'
import { applyWeaponDefinition, type Health, type Input, type NetworkIdentity, type WeaponState } from '../components'
import { SUPPORTED_WEAPON_IDS } from '../../game/supportedWeaponModels'

const MAX_HOTKEY_WEAPONS = 9

export function createWeaponLoadoutSystem(world: World) {
  const previousByEntity = new Map<object, Map<string, boolean>>()
  const weaponIds = SUPPORTED_WEAPON_IDS.slice(0, MAX_HOTKEY_WEAPONS)

  return (_deltaTime: number) => {
    for (const entity of world.with('input', 'weaponState', 'networkIdentity')) {
      const input = entity.input as Input
      const weaponState = entity.weaponState as WeaponState
      const networkIdentity = entity.networkIdentity as NetworkIdentity
      const health = (entity as { health?: Health }).health
      if (!networkIdentity.isLocal) continue
      if (health?.isDead) continue

      let previous = previousByEntity.get(entity)
      if (!previous) {
        previous = new Map()
        previousByEntity.set(entity, previous)
      }

      for (let index = 0; index < weaponIds.length; index += 1) {
        const weaponId = weaponIds[index]!
        const key = String(index + 1)
        const down = !!input.keys.get(key)
        const wasDown = previous.get(key) ?? false
        if (down && !wasDown) {
          applyWeaponDefinition(weaponState, weaponId)
          networkIdentity.weaponId = weaponState.weaponId
        }
        previous.set(key, down)
      }
    }
  }
}
