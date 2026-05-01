import { getWeaponDefinition } from '../../config/weaponCatalog'

export type WeaponAction = 'fire' | 'reload' | 'hide' | 'pick' | 'walk' | 'run'

export interface WeaponState {
  weaponId: string
  fireRate: number
  damage: number
  magazineSize: number
  ammoInMag: number
  cooldownSec: number
  isPicking: boolean
  pickRemainingSec: number
  isReloading: boolean
  reloadRemainingSec: number
  emptyShotCounter: number
  action: WeaponAction
  actionHoldSec: number
}

export function createWeaponState(weaponId: string): WeaponState {
  const definition = getWeaponDefinition(weaponId)
  return {
    weaponId: definition.weaponId,
    fireRate: definition.fireRate,
    damage: definition.damage,
    magazineSize: definition.magazineSize,
    ammoInMag: definition.magazineSize,
    cooldownSec: 0,
    isPicking: false,
    pickRemainingSec: 0,
    isReloading: false,
    reloadRemainingSec: 0,
    emptyShotCounter: 0,
    action: 'walk',
    actionHoldSec: 0,
  }
}

export function applyWeaponDefinition(state: WeaponState, weaponId: string): void {
  const definition = getWeaponDefinition(weaponId)
  state.weaponId = definition.weaponId
  state.fireRate = definition.fireRate
  state.damage = definition.damage
  state.magazineSize = definition.magazineSize
  state.ammoInMag = Math.max(0, Math.min(state.ammoInMag, definition.magazineSize))
  state.cooldownSec = 0
  state.isPicking = true
  state.pickRemainingSec = definition.pickTimeSec
  state.isReloading = false
  state.reloadRemainingSec = 0
  state.emptyShotCounter = 0
  state.action = 'pick'
  state.actionHoldSec = definition.pickTimeSec
}
