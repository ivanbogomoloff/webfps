import type { World } from 'miniplex'

export function createMatchRulesClientSystem(world: World) {
  return (_deltaTime: number) => {
    for (const entity of world.with('matchState')) {
      if (entity.matchState.timeLeftSec < 0) {
        entity.matchState.timeLeftSec = 0
      }
      if (entity.matchState.phase === 'ended' && entity.matchState.winnerPlayerId == null) {
        const board = (entity.scoreboard as Array<{ playerId: string }> | undefined) ?? []
        entity.matchState.winnerPlayerId = board[0]?.playerId ?? null
      }
    }
  }
}
