import type { World } from 'miniplex'
import type { NetworkContext } from '../../net/NetworkContext'
import type { MatchState } from '../components'

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

    networkContext.sendState({
      x: local.object3d.position.x,
      y: local.object3d.position.y,
      z: local.object3d.position.z,
      rotY: local.object3d.rotation.y,
      role: local.networkIdentity.role,
      frags: local.playerStats.frags,
      deaths: local.playerStats.deaths,
    })
  }
}
