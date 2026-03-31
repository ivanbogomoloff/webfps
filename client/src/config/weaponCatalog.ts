export type WeaponDefinition = {
  model: string
  fireRate: number
  damage: number
  magazineSize: number
}

export const WEAPON_CATALOG = {
  pistol: {
    model: 'colt_m4a1_low-poly',
    fireRate: 3,
    damage: 20,
    magazineSize: 12,
  },
  rifle: {
    model: 'colt_m4a1_low-poly',
    fireRate: 8,
    damage: 12,
    magazineSize: 30,
  },
} as const satisfies Record<string, WeaponDefinition>

export type WeaponId = keyof typeof WEAPON_CATALOG

export const SUPPORTED_WEAPON_IDS = Object.keys(WEAPON_CATALOG) as WeaponId[]

export const DEFAULT_WEAPON_ID: WeaponId = 'pistol'

export function weaponModelGltfPath(weaponId: WeaponId): string {
  return `/models/weapons/${WEAPON_CATALOG[weaponId].model}.glb`
}

export function resolveWeaponId(raw: string): WeaponId {
  const normalized = raw.trim().toLowerCase()
  return (SUPPORTED_WEAPON_IDS as readonly string[]).includes(normalized)
    ? (normalized as WeaponId)
    : DEFAULT_WEAPON_ID
}

export function getWeaponDefinition(rawWeaponId: string): WeaponDefinition & { weaponId: WeaponId } {
  const weaponId = resolveWeaponId(rawWeaponId)
  return {
    weaponId,
    ...WEAPON_CATALOG[weaponId],
  }
}
