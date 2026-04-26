import type { World } from 'miniplex'
import * as THREE from 'three'
import type { MatchState } from '../components'
import type { NetworkContext } from '../../net/NetworkContext'

const EPSILON = 1e-6
const direction = new THREE.Vector3()
const origin = new THREE.Vector3()
const forwardOffset = new THREE.Vector3()

export function createShotSendSystem(world: World, networkContext: NetworkContext) {
  const matchQuery = world.with('matchState')
  let wasPrimaryDown = false
  let shotSeq = 0
  let cooldownSec = 0

  return (deltaTime: number) => {
    const local = networkContext.getLocalPlayerEntity()
    if (!local?.input?.mouse || !local?.camera || !local?.networkIdentity || !local?.weaponState || !local?.health) {
      wasPrimaryDown = false
      return
    }

    cooldownSec = Math.max(0, cooldownSec - deltaTime)
    const primaryDown = !!local.input.mouse.primaryDown
    const justPressed = primaryDown && !wasPrimaryDown
    wasPrimaryDown = primaryDown
    if (!justPressed || cooldownSec > 0 || local.weaponState.isReloading) return

    let match: { matchState: MatchState } | undefined
    for (const entity of matchQuery) {
      match = entity as { matchState: MatchState }
      break
    }
    if (match?.matchState.phase === 'ended') return
    if (local.networkIdentity.role !== 'player' || local.health.isDead) return

    local.camera.getWorldDirection(direction)
    if (direction.lengthSq() <= EPSILON) return
    direction.normalize()
    origin.copy(local.camera.position)
    forwardOffset.copy(direction).multiplyScalar(0.12)
    origin.add(forwardOffset)

    shotSeq += 1
    networkContext.sendShot({
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      weaponId: local.weaponState.weaponId ?? local.networkIdentity.weaponId ?? 'rifle_m16',
      seq: shotSeq,
      clientTime: Date.now(),
    })
    local.weaponState.action = 'fire'
    local.weaponState.actionHoldSec = 0.1
    cooldownSec = Math.max(0.06, 1 / Math.max(1, local.weaponState.fireRate))
  }
}
