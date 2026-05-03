import { getWeaponDefinition } from '../../config/weaponCatalog'

export type WeaponAction = 'fire' | 'reload' | 'hide' | 'pick' | 'walk' | 'run'
export type WeaponSwitchPhase = 'none' | 'hide' | 'pick'

export interface WeaponState {
  weaponId: string
  fireRate: number
  damage: number
  magazineSize: number
  ammoInMag: number
  cooldownSec: number
  isPicking: boolean
  pickRemainingSec: number
  isSwitching: boolean
  switchPhase: WeaponSwitchPhase
  switchRemainingSec: number
  switchPhaseSec: number
  pendingWeaponId: string | null
  pendingAmmoInMag: number
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
    isSwitching: false,
    switchPhase: 'none',
    switchRemainingSec: 0,
    switchPhaseSec: 0,
    pendingWeaponId: null,
    pendingAmmoInMag: 0,
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
  state.isSwitching = false
  state.switchPhase = 'none'
  state.switchRemainingSec = 0
  state.switchPhaseSec = 0
  state.pendingWeaponId = null
  state.pendingAmmoInMag = 0
  state.isReloading = false
  state.reloadRemainingSec = 0
  state.emptyShotCounter = 0
  state.action = 'pick'
  state.actionHoldSec = definition.pickTimeSec
}
