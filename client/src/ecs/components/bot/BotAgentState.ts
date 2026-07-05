import type { BotCombatState } from '../../../game/bot/BotCombatBrain';
import { createBotCombatState } from '../../../game/bot/BotCombatBrain';
import type { BotMovementState } from '../../../game/bot/BotMovementBrain';
import { createBotMovementState } from '../../../game/bot/BotMovementBrain';

export type BotAgentState = {
  movement: BotMovementState;
  combat: BotCombatState;
  predictedX: number;
  predictedY: number;
  predictedZ: number;
  predictedRotY: number;
  targetId: string | null;
  waypointIndex: number;
  path: number[];
};

export function createBotAgentState(weaponId: string): BotAgentState {
  return {
    movement: createBotMovementState(),
    combat: createBotCombatState(weaponId),
    predictedX: 0,
    predictedY: 0,
    predictedZ: 0,
    predictedRotY: 0,
    targetId: null,
    waypointIndex: 0,
    path: [],
  };
}
