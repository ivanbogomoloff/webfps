import type { World } from 'miniplex'
import { applyWeaponDefinition, type Health, type Input, type NetworkIdentity, type WeaponState } from '../components'
import { getWeaponDefinition, SUPPORTED_WEAPON_IDS } from '../../game/weapon/supportedWeaponModels'

const MAX_HOTKEY_WEAPONS = 9

export function createWeaponLoadoutSystem(world: World) {
  const previousByEntity = new Map<object, Map<string, boolean>>()
  const ammoByWeaponByEntity = new Map<object, Map<string, number>>()
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
      let ammoByWeapon = ammoByWeaponByEntity.get(entity)
      if (!ammoByWeapon) {
        ammoByWeapon = new Map()
        ammoByWeaponByEntity.set(entity, ammoByWeapon)
      }
      ammoByWeapon.set(
        weaponState.weaponId,
        Math.max(0, Math.min(weaponState.ammoInMag, weaponState.magazineSize)),
      )

      for (let index = 0; index < weaponIds.length; index += 1) {
        const weaponId = weaponIds[index]!
        const key = String(index + 1)
        const down = !!input.keys.get(key)
        const wasDown = previous.get(key) ?? false
        if (down && !wasDown) {
          if (weaponState.weaponId === weaponId) {
            previous.set(key, down)
            continue
          }
          ammoByWeapon.set(
            weaponState.weaponId,
            Math.max(0, Math.min(weaponState.ammoInMag, weaponState.magazineSize)),
          )
          applyWeaponDefinition(weaponState, weaponId)
          const storedAmmo = ammoByWeapon.get(weaponState.weaponId)
          weaponState.ammoInMag =
            storedAmmo == null
              ? weaponState.magazineSize
              : Math.max(0, Math.min(storedAmmo, weaponState.magazineSize))
          const pickTimeSec = Math.max(0, getWeaponDefinition(weaponState.weaponId).pickTimeSec)
          weaponState.isPicking = pickTimeSec > 0
          weaponState.pickRemainingSec = pickTimeSec
          weaponState.action = 'pick'
          weaponState.actionHoldSec = pickTimeSec
          ammoByWeapon.set(weaponState.weaponId, weaponState.ammoInMag)
          networkIdentity.weaponId = weaponState.weaponId
        }
        previous.set(key, down)
      }
    }
  }
}
