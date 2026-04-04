import * as THREE from 'three'
import { cloneWeaponVisualTemplate } from './weaponModelTemplates'

const SOCKET_HINTS = [
  'socket_weapon_r',
  'weapon_socket',
  'weaponsocket',
  'weapon',
  'righthand',
  'right_hand',
  'hand_r',
  'mixamorig:righthand',
  'mixamorigrighthand',
]

export type WeaponMountType = 'socket' | 'fallback'

export type WeaponTransformValues = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

const DEFAULT_WEAPON_TRANSFORM_BY_MOUNT: Record<WeaponMountType, WeaponTransformValues> = {
  fallback: {
    position: { x: 0.35, y: 0.95, z: 0.15 },
    rotation: { x: 0, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  socket: {
    position: { x: 0.12, y: 0.02, z: -0.02 },
    rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
}

function cloneTransformValues(values: WeaponTransformValues): WeaponTransformValues {
  return {
    position: { ...values.position },
    rotation: { ...values.rotation },
    scale: { ...values.scale },
  }
}

export function getDefaultWeaponTransformValues(mountType: WeaponMountType): WeaponTransformValues {
  return cloneTransformValues(DEFAULT_WEAPON_TRANSFORM_BY_MOUNT[mountType])
}

export function applyWeaponTransformValues(
  weaponObject: THREE.Object3D,
  values: WeaponTransformValues,
): void {
  // Use XZY to avoid Y-axis gimbal lock at common weapon defaults (x=+90°, y=-90°),
  // so roll (z) remains adjustable in tooling and in-game.
  weaponObject.rotation.order = 'XZY'
  weaponObject.position.set(values.position.x, values.position.y, values.position.z)
  weaponObject.rotation.set(values.rotation.x, values.rotation.y, values.rotation.z)
  weaponObject.scale.set(values.scale.x, values.scale.y, values.scale.z)
}

export function findWeaponMount(root: THREE.Object3D): THREE.Object3D {
  let exactSocket: THREE.Object3D | null = null
  const candidates: THREE.Object3D[] = []
  root.traverse((node) => {
    const name = node.name.trim().toLowerCase()
    if (!name) return
    if (name === 'socket_weapon_r') {
      exactSocket = node
      return
    }
    if (SOCKET_HINTS.some((hint) => name.includes(hint))) {
      candidates.push(node)
    }
  })
  return exactSocket ?? candidates[0] ?? root
}

export function getWeaponMountType(root: THREE.Object3D, mount: THREE.Object3D): WeaponMountType {
  return mount === root ? 'fallback' : 'socket'
}

export function replaceWeaponVisual(
  root: THREE.Object3D,
  previousWeaponObject: THREE.Object3D | null | undefined,
  weaponTemplate: THREE.Object3D | null | undefined,
): THREE.Object3D | null {
  if (previousWeaponObject?.parent) {
    previousWeaponObject.parent.remove(previousWeaponObject)
  }
  if (!weaponTemplate) return null

  const mount = findWeaponMount(root)
  const mountType = getWeaponMountType(root, mount)
  const mountIsRootFallback = mountType === 'fallback'
  const weaponObject = cloneWeaponVisualTemplate(weaponTemplate)
  weaponObject.name = `WeaponVisual:${weaponObject.name || 'unnamed'}`
  applyWeaponTransformValues(weaponObject, getDefaultWeaponTransformValues(mountType))

  // У некоторых ригов кости имеют масштаб ~0.01, из-за чего дочерние объекты становятся невидимо маленькими.
  // Компенсируем мировой масштаб точки крепления, чтобы weapon оставался читаемым.
  const mountScale = new THREE.Vector3()
  mount.getWorldScale(mountScale)
  const EPS = 1e-4
  if (Math.abs(mountScale.x) > EPS && Math.abs(mountScale.y) > EPS && Math.abs(mountScale.z) > EPS) {
    weaponObject.scale.set(
      weaponObject.scale.x / mountScale.x,
      weaponObject.scale.y / mountScale.y,
      weaponObject.scale.z / mountScale.z,
    )
  }

  mount.add(weaponObject)
  console.log(
    `[weaponAttach] mounted '${weaponObject.name}' on '${mount.name || 'root'}' (fallback=${mountIsRootFallback}) pos=(${weaponObject.position.x.toFixed(2)},${weaponObject.position.y.toFixed(2)},${weaponObject.position.z.toFixed(2)}) rot=(${weaponObject.rotation.x.toFixed(2)},${weaponObject.rotation.y.toFixed(2)},${weaponObject.rotation.z.toFixed(2)}) scale=(${weaponObject.scale.x.toFixed(2)}) mountScale=(${mountScale.x.toFixed(3)},${mountScale.y.toFixed(3)},${mountScale.z.toFixed(3)})`,
  )
  return weaponObject
}
