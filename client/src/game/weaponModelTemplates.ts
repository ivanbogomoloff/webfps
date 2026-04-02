import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  DEFAULT_WEAPON_ID,
  SUPPORTED_WEAPON_IDS,
  type SupportedWeaponId,
  weaponModelGltfPath,
} from './supportedWeaponModels'

function normalizeWeaponTemplate(root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  const longest = Math.max(size.x, size.y, size.z)
  if (longest <= 0) return

  const desiredLongest = 0.6
  //const scale = THREE.MathUtils.clamp(desiredLongest / longest, 0.01, 20)
  //root.scale.multiplyScalar(scale)
  //root.position.sub(center.multiplyScalar(scale))
  root.updateMatrixWorld(true)
}

function emptyWeaponTemplate(): THREE.Object3D {
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x666666 }),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  root.add(mesh)
  return root
}

export async function loadSupportedWeaponModelTemplates(): Promise<
  Map<SupportedWeaponId, THREE.Object3D>
> {
  const loader = new GLTFLoader()
  const map = new Map<SupportedWeaponId, THREE.Object3D>()

  for (const weaponId of SUPPORTED_WEAPON_IDS) {
    const glbPath = weaponModelGltfPath(weaponId)
    try {
      const gltf = await loader.loadAsync(glbPath)
      gltf.scene.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (mesh.isMesh) {
          mesh.castShadow = true
          mesh.receiveShadow = true
        }
      })
      normalizeWeaponTemplate(gltf.scene)
      map.set(weaponId, gltf.scene)
      console.log(`[weaponModelTemplates] loaded weapon '${weaponId}' from '${glbPath}'`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const htmlInsteadOfGltf = message.includes(`Unexpected token '<'`)
      if (htmlInsteadOfGltf) {
        console.warn(
          `[weaponModelTemplates] '${weaponId}' expected GLB at '${glbPath}', got HTML (usually missing file/path). Using fallback mesh.`,
        )
      } else {
        console.warn(
          `[weaponModelTemplates] failed to load weapon '${weaponId}' from '${glbPath}'. Using fallback mesh. Reason: ${message}`,
        )
      }
      map.set(weaponId, emptyWeaponTemplate())
    }
  }

  if (!map.has(DEFAULT_WEAPON_ID)) {
    map.set(DEFAULT_WEAPON_ID, emptyWeaponTemplate())
  }

  return map
}

export function cloneWeaponVisualTemplate(template: THREE.Object3D): THREE.Object3D {
  return SkeletonUtils.clone(template) as THREE.Object3D
}
