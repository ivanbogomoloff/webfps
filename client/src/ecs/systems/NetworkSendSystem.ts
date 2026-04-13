import type { World } from 'miniplex'
import * as THREE from 'three'
import type { NetworkContext } from '../../net/NetworkContext'
import type { MatchState } from '../components'

const DEFAULT_HITBOX_RADIUS = 0.5
const DEFAULT_CENTER_Y_OFFSET = 0.65
const tempBounds = new THREE.Box3()
const tempCenter = new THREE.Vector3()

function getHitboxCenterY(local: Record<string, any>): number {
  const root = (local.weaponVisualRoot as THREE.Object3D | undefined) ?? (local.object3d as THREE.Object3D | undefined)
  if (root) {
    tempBounds.setFromObject(root)
    if (!tempBounds.isEmpty()) {
      tempBounds.getCenter(tempCenter)
      return tempCenter.y
    }
  }
  return local.object3d.position.y + DEFAULT_CENTER_Y_OFFSET
}

export function createNetworkSendSystem(world: World, networkContext: NetworkContext) {
  let accumulator = 0
  const sendInterval = 1 / 20

  return (deltaTime: number) => {
    accumulator += deltaTime
    if (accumulator < sendInterval) return
    accumulator = 0

    const local = networkContext.getLocalPlayerEntity()
    if (!local?.object3d || !local?.networkIdentity || !local?.playerStats) return

    const match = Array.from(world.with('matchState'))[0] as { matchState: MatchState } | undefined
    if (match?.matchState.phase === 'ended') return

    const locomotion = (local as any).playerController?.locomotion ?? 'idle'

    networkContext.sendState({
      x: local.object3d.position.x,
      y: local.object3d.position.y,
      z: local.object3d.position.z,
      rotY: local.object3d.rotation.y,
      role: local.networkIdentity.role,
      frags: local.playerStats.frags,
      deaths: local.playerStats.deaths,
      locomotion,
      weaponId: local.weaponState?.weaponId ?? local.networkIdentity.weaponId ?? 'rifle_m16',
      hitbox: {
        center: {
          x: local.object3d.position.x,
          y: getHitboxCenterY(local as Record<string, any>),
          z: local.object3d.position.z,
        },
        radius: DEFAULT_HITBOX_RADIUS,
      },
    })
  }
}
