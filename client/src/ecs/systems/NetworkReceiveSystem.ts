import type { World } from 'miniplex'
import * as THREE from 'three'
import { createNetworkIdentity, createPlayerStats } from '../components'
import type { NetworkContext } from '../../net/NetworkContext'

type AnyEntity = Record<string, any>

export function createNetworkReceiveSystem(world: World, scene: THREE.Scene, networkContext: NetworkContext) {
  return (_deltaTime: number) => {
    const messages = networkContext.consumeQueue()
    if (messages.length === 0) return

    const matchEntity = Array.from(world.with('matchState'))[0] as AnyEntity | undefined
    const localEntity = networkContext.getLocalPlayerEntity()

    for (const message of messages) {
      switch (message.type) {
        case 'room_joined': {
          networkContext.setLocalPlayerId(message.payload.localPlayerId)
          if (matchEntity?.matchState) {
            matchEntity.matchState.maxPlayers = message.payload.maxPlayers
          }
          if (localEntity) {
            localEntity.networkIdentity = createNetworkIdentity(
              message.payload.localPlayerId,
              localEntity.networkIdentity?.nickname ?? 'Player',
              localEntity.networkIdentity?.modelId ?? 'player1',
              true,
              localEntity.networkIdentity?.role ?? 'spectator'
            )
            networkContext.registerPlayerEntity(message.payload.localPlayerId, localEntity)
          }
          break
        }
        case 'room_state': {
          if (matchEntity?.matchState) {
            matchEntity.matchState.phase = message.payload.phase
            matchEntity.matchState.timeLimitSec = message.payload.timeLimitSec
            matchEntity.matchState.timeLeftSec = message.payload.timeLeftSec
            matchEntity.matchState.fragLimit = message.payload.fragLimit
          }
          for (const player of message.payload.players) {
            if (player.playerId === networkContext.getLocalPlayerId()) {
              if (localEntity?.networkIdentity) localEntity.networkIdentity.role = player.role
              if (localEntity?.playerStats) {
                localEntity.playerStats.frags = player.frags
                localEntity.playerStats.deaths = player.deaths
              }
              continue
            }
            const remote = networkContext.getOrCreateRemoteEntity(
              world,
              scene,
              player.playerId,
              player.nickname,
              player.modelId,
              player.role
            )
            remote.networkIdentity.role = player.role
            remote.playerStats.frags = player.frags
            remote.playerStats.deaths = player.deaths
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
            if (state.playerId === networkContext.getLocalPlayerId()) continue
            let entity = networkContext.getPlayerEntity(state.playerId)
            if (!entity) {
              entity = networkContext.getOrCreateRemoteEntity(
                world,
                scene,
                state.playerId,
                'Remote',
                state.modelId || 'player1',
                state.role,
              )
            }
            entity.networkTransform.x = state.x
            entity.networkTransform.y = state.y
            entity.networkTransform.z = state.z
            entity.networkTransform.rotY = state.rotY
            entity.networkTransform.updatedAtMs = performance.now()
            entity.networkIdentity.role = state.role
            entity.playerStats.frags = state.frags
            entity.playerStats.deaths = state.deaths
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
