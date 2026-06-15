import type { World } from 'miniplex'
import { applyWeaponDefinition, type Health, type Input, type NetworkIdentity, type WeaponState } from '../components'
import { GAME_WEAPON_IDS, getWeaponDefinition } from '../../game/weapon/supportedWeaponModels'

const MAX_HOTKEY_WEAPONS = 9

export function createWeaponLoadoutSystem(world: World) {
  const previousByEntity = new Map<object, Map<string, boolean>>()
  const ammoByWeaponByEntity = new Map<object, Map<string, number>>()
  const previousIsDeadByEntity = new Map<object, boolean>()
  const weaponIds = GAME_WEAPON_IDS.slice(0, MAX_HOTKEY_WEAPONS)

  return (_deltaTime: number) => {
    for (const entity of world.with('input', 'weaponState', 'networkIdentity')) {
      const input = entity.input as Input
      const weaponState = entity.weaponState as WeaponState
      const networkIdentity = entity.networkIdentity as NetworkIdentity
      const health = (entity as { health?: Health }).health
      if (!networkIdentity.isLocal) continue

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

      const isDead = health?.isDead ?? false
      const wasDead = previousIsDeadByEntity.get(entity) ?? false
      previousIsDeadByEntity.set(entity, isDead)
      if (!wasDead && isDead) {
        ammoByWeapon.clear()
        weaponState.ammoInMag = weaponState.magazineSize
      }
      if (isDead) continue
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
          if (weaponState.isSwitching) {
            previous.set(key, down)
            continue
          }
          if (weaponState.weaponId === weaponId) {
            previous.set(key, down)
            continue
          }
          ammoByWeapon.set(
            weaponState.weaponId,
            Math.max(0, Math.min(weaponState.ammoInMag, weaponState.magazineSize)),
          )
          const targetDefinition = getWeaponDefinition(weaponId)
          const targetWeaponId = targetDefinition.weaponId
          const pickTimeSec = Math.max(0, targetDefinition.pickTimeSec)
          if (pickTimeSec <= 0) {
            applyWeaponDefinition(weaponState, targetWeaponId)
            const instantAmmo = ammoByWeapon.get(weaponState.weaponId)
            weaponState.ammoInMag =
              instantAmmo == null
                ? weaponState.magazineSize
                : Math.max(0, Math.min(instantAmmo, weaponState.magazineSize))
            weaponState.isPicking = false
            weaponState.pickRemainingSec = 0
            weaponState.actionHoldSec = 0
            ammoByWeapon.set(weaponState.weaponId, weaponState.ammoInMag)
            networkIdentity.weaponId = weaponState.weaponId
            previous.set(key, down)
            continue
          }

          const storedAmmo = ammoByWeapon.get(targetWeaponId)
          const targetAmmo =
            storedAmmo == null
              ? targetDefinition.magazineSize
              : Math.max(0, Math.min(storedAmmo, targetDefinition.magazineSize))
          const phaseSec = pickTimeSec / 2
          weaponState.isPicking = true
          weaponState.pickRemainingSec = phaseSec
          weaponState.isSwitching = true
          weaponState.switchPhase = 'hide'
          weaponState.switchRemainingSec = phaseSec
          weaponState.switchPhaseSec = phaseSec
          weaponState.pendingWeaponId = targetWeaponId
          weaponState.pendingAmmoInMag = targetAmmo
          weaponState.isReloading = false
          weaponState.reloadRemainingSec = 0
          weaponState.action = 'hide'
          weaponState.actionHoldSec = phaseSec
        }
        previous.set(key, down)
      }
    }
  }
}
