import type { MatchPhase } from '../../net/protocol'

export interface MatchState {
  phase: MatchPhase
  timeLimitSec: number
  timeLeftSec: number
  fragLimit: number
  winnerPlayerId: string | null
  maxPlayers: number
}

export function createMatchState(): MatchState {
  return {
    phase: 'waiting',
    timeLimitSec: 600,
    timeLeftSec: 600,
    fragLimit: 25,
    winnerPlayerId: null,
    maxPlayers: 4,
  }
}
