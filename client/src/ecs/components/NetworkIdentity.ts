import type { PlayerRole } from '../../net/protocol'

export interface NetworkIdentity {
  playerId: string
  nickname: string
  modelId: string
  isLocal: boolean
  role: PlayerRole
}

export function createNetworkIdentity(
  playerId: string,
  nickname: string,
  modelId: string,
  isLocal: boolean,
  role: PlayerRole
): NetworkIdentity {
  return {
    playerId,
    nickname,
    modelId,
    isLocal,
    role,
  }
}
