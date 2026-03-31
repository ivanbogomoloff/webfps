import * as THREE from 'three'
import { cloneWeaponVisualTemplate } from './weaponModelTemplates'

const SOCKET_HINTS = [
  'weapon_socket',
  'weaponsocket',
  'weapon',
  'righthand',
  'right_hand',
  'hand_r',
  'mixamorig:righthand',
  'mixamorigrighthand',
]

function findWeaponMount(root: THREE.Object3D): THREE.Object3D {
  const candidates: THREE.Object3D[] = []
  root.traverse((node) => {
    const name = node.name.trim().toLowerCase()
    if (!name) return
    if (SOCKET_HINTS.some((hint) => name.includes(hint))) {
      candidates.push(node)
    }
  })
  return candidates[0] ?? root
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
  const mountIsRootFallback = mount === root
  const weaponObject = cloneWeaponVisualTemplate(weaponTemplate)
  weaponObject.name = `WeaponVisual:${weaponObject.name || 'unnamed'}`
  if (mountIsRootFallback) {
    weaponObject.position.set(0.35, 0.95, 0.15)
    weaponObject.rotation.set(0, -Math.PI / 2, 0)
  } else {
    weaponObject.position.set(0.15, 0.02, -0.04)
    weaponObject.rotation.set(0, Math.PI, 0)
  }

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
    `[weaponAttach] mounted '${weaponObject.name}' on '${mount.name || 'root'}' (fallback=${mountIsRootFallback}) pos=(${weaponObject.position.x.toFixed(2)},${weaponObject.position.y.toFixed(2)},${weaponObject.position.z.toFixed(2)}) scale=(${weaponObject.scale.x.toFixed(2)}) mountScale=(${mountScale.x.toFixed(3)},${mountScale.y.toFixed(3)},${mountScale.z.toFixed(3)})`,
  )
  return weaponObject
}
