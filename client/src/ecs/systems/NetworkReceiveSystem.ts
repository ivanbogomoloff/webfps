import type { World } from 'miniplex'
import * as THREE from 'three'
import { createNetworkIdentity, createPlayerStats } from '../components'
import type { NetworkContext } from '../../net/NetworkContext'
import { parseNetworkLocomotion } from '../../game/player/playerLocomotionLogic'

type AnyEntity = Record<string, any>
type ActiveHitMarker = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  victimEntity: AnyEntity
  expiresAtMs: number
}

export function createNetworkReceiveSystem(world: World, scene: THREE.Scene, networkContext: NetworkContext) {
  const markerGeometry = new THREE.SphereGeometry(0.06, 8, 8)
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xff2b2b,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
  })
  const hitFadeDurationMs = 260
  const maxActiveMarkers = 24
  const activeHitMarkers: ActiveHitMarker[] = []
  const tempWorldPoint = new THREE.Vector3()

  return (_deltaTime: number) => {
    const now = performance.now()
    for (let i = activeHitMarkers.length - 1; i >= 0; i -= 1) {
      const marker = activeHitMarkers[i]
      const lifeLeft = marker.expiresAtMs - now
      if (lifeLeft <= 0) {
        marker.victimEntity.object3d?.remove(marker.mesh)
        marker.mesh.material.dispose()
        activeHitMarkers.splice(i, 1)
        continue
      }
      marker.mesh.material.opacity = Math.max(0.08, lifeLeft / hitFadeDurationMs)
      marker.mesh.scale.setScalar(0.6 + (1 - lifeLeft / hitFadeDurationMs) * 0.6)
    }

    const messages = networkContext.consumeQueue()
    if (messages.length === 0) return

    const matchEntity = Array.from(world.with('matchState'))[0] as AnyEntity | undefined
    const localEntity = networkContext.getLocalPlayerEntity()

    for (const message of messages) {
      switch (message.type) {
        case 'room_joined': {
          networkContext.setLocalPlayerId(message.payload.localPlayerId)
          networkContext.setOwnerPlayerId(message.payload.ownerPlayerId)
          if (matchEntity?.matchState) {
            matchEntity.matchState.maxPlayers = message.payload.maxPlayers
          }
          if (localEntity) {
            localEntity.networkIdentity = createNetworkIdentity(
              message.payload.localPlayerId,
              localEntity.networkIdentity?.nickname ?? 'Player',
              localEntity.networkIdentity?.modelId ?? 'player1',
              localEntity.networkIdentity?.weaponId ?? 'rifle_m16',
              true,
              localEntity.networkIdentity?.role ?? 'spectator'
            )
            networkContext.registerPlayerEntity(message.payload.localPlayerId, localEntity)
          }
          break
        }
        case 'room_state': {
          networkContext.setOwnerPlayerId(message.payload.ownerPlayerId)
          if (matchEntity?.matchState) {
            matchEntity.matchState.phase = message.payload.phase
            matchEntity.matchState.timeLimitSec = message.payload.timeLimitSec
            matchEntity.matchState.timeLeftSec = message.payload.timeLeftSec
            matchEntity.matchState.fragLimit = message.payload.fragLimit
          }
          for (const player of message.payload.players) {
            if (player.playerId === networkContext.getLocalPlayerId()) {
              if (localEntity?.networkIdentity) localEntity.networkIdentity.role = player.role
              if (localEntity) {
                networkContext.setEntityWeapon(localEntity, player.weaponId || 'rifle_m16')
              }
              if (localEntity?.playerStats) {
                localEntity.playerStats.frags = player.frags
                localEntity.playerStats.deaths = player.deaths
              }
              if (localEntity?.health && player.role !== 'player') {
                localEntity.health.isDead = false
                localEntity.health.current = localEntity.health.max
                localEntity.health.respawnInSec = 0
                localEntity.health.forcedLocomotion = null
              }
              continue
            }
            const remote = networkContext.getOrCreateRemoteEntity(
              world,
              scene,
              player.playerId,
              player.nickname,
              player.modelId,
              player.weaponId,
              player.role
            )
            remote.networkIdentity.role = player.role
            remote.playerStats.frags = player.frags
            remote.playerStats.deaths = player.deaths
            if (remote.health && player.role !== 'player') {
              remote.health.isDead = false
              remote.health.current = remote.health.max
              remote.health.respawnInSec = 0
              remote.health.forcedLocomotion = null
            }
          }
          break
        }
        case 'player_joined': {
          if (message.payload.playerId === networkContext.getLocalPlayerId()) break
          networkContext.getOrCreateRemoteEntity(
            world,
            scene,
            message.payload.playerId,
            message.payload.nickname,
            message.payload.modelId,
            message.payload.weaponId,
            message.payload.role
          )
          break
        }
        case 'player_left': {
          networkContext.removePlayerEntity(world, scene, message.payload.playerId)
          break
        }
        case 'player_state_batch': {
          for (const state of message.payload.states) {
            if (state.playerId === networkContext.getLocalPlayerId()) {
              if (!localEntity) continue
              if (localEntity.health) {
                localEntity.health.current = state.health
                localEntity.health.max = state.maxHealth
                localEntity.health.isDead = state.isDead
                localEntity.health.respawnInSec = state.respawnInSec
                localEntity.health.forcedLocomotion = state.forcedLocomotion ?? null
              }
              const localPc = (localEntity as any).playerController as { locomotion?: string } | undefined
              if (localPc && state.isDead) {
                localPc.locomotion = parseNetworkLocomotion(state.forcedLocomotion ?? state.locomotion)
              }
              continue
            }
            let entity = networkContext.getPlayerEntity(state.playerId)
            if (!entity) {
              entity = networkContext.getOrCreateRemoteEntity(
                world,
                scene,
                state.playerId,
                'Remote',
                state.modelId || 'player1',
                state.weaponId || 'rifle_m16',
                state.role,
              )
            }
            entity.networkTransform.x = state.x
            entity.networkTransform.y = state.y
            entity.networkTransform.z = state.z
            entity.networkTransform.rotY = state.rotY
            entity.networkTransform.updatedAtMs = performance.now()
            entity.networkIdentity.role = state.role
            networkContext.setEntityWeapon(entity, state.weaponId || 'rifle_m16')
            entity.playerStats.frags = state.frags
            entity.playerStats.deaths = state.deaths
            if (entity.health) {
              entity.health.current = state.health
              entity.health.max = state.maxHealth
              entity.health.isDead = state.isDead
              entity.health.respawnInSec = state.respawnInSec
              entity.health.forcedLocomotion = state.forcedLocomotion ?? null
            }
            const pc = (entity as any).playerController as { locomotion?: string } | undefined
            if (pc) {
              const locomotion = state.isDead
                ? (state.forcedLocomotion ?? state.locomotion)
                : state.locomotion
              pc.locomotion = parseNetworkLocomotion(locomotion)
            }
          }
          break
        }
        case 'player_hit_effect': {
          const victimEntity = networkContext.getPlayerEntity(message.payload.victimPlayerId)
          if (!victimEntity?.object3d) break
          tempWorldPoint.set(message.payload.point.x, message.payload.point.y, message.payload.point.z)
          victimEntity.object3d.worldToLocal(tempWorldPoint)
          const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial.clone())
          markerMesh.position.copy(tempWorldPoint)
          markerMesh.renderOrder = 10
          victimEntity.object3d.add(markerMesh)
          activeHitMarkers.push({
            mesh: markerMesh as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>,
            victimEntity,
            expiresAtMs: now + hitFadeDurationMs,
          })
          while (activeHitMarkers.length > maxActiveMarkers) {
            const removed = activeHitMarkers.shift()
            if (!removed) break
            removed.victimEntity.object3d?.remove(removed.mesh)
            removed.mesh.material.dispose()
          }
          break
        }
        case 'scoreboard_update': {
          networkContext.scoreboard = message.payload.players
          for (const boardEntry of message.payload.players) {
            const entity = networkContext.getPlayerEntity(boardEntry.playerId)
            if (!entity) continue
            if (!entity.playerStats) {
              entity.playerStats = createPlayerStats()
            }
            entity.playerStats.frags = boardEntry.frags
            entity.playerStats.deaths = boardEntry.deaths
          }
          break
        }
        case 'match_tick': {
          if (matchEntity?.matchState) {
            matchEntity.matchState.timeLeftSec = message.payload.timeLeftSec
          }
          break
        }
        case 'match_started': {
          if (matchEntity?.matchState) {
            matchEntity.matchState.phase = 'running'
            matchEntity.matchState.timeLimitSec = message.payload.timeLimitSec
            matchEntity.matchState.timeLeftSec = message.payload.timeLimitSec
            matchEntity.matchState.fragLimit = message.payload.fragLimit
            matchEntity.matchState.winnerPlayerId = null
          }
          break
        }
        case 'match_ended': {
          if (matchEntity?.matchState) {
            matchEntity.matchState.phase = 'ended'
            matchEntity.matchState.winnerPlayerId = message.payload.winnerPlayerId
          }
          networkContext.scoreboard = message.payload.players
          break
        }
        case 'error': {
          networkContext.lastError = `${message.payload.code}: ${message.payload.message}`
          break
        }
      }
    }
  }
}
