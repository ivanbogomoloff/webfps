import type { BotNavGraphData } from '../../../game/bot/types';

export type BotNavGraph = BotNavGraphData & {
  isReady: boolean;
};

export function createBotNavGraph(mapId: string): BotNavGraph {
  return {
    mapId,
    waypoints: [],
    edges: [],
    builtAtMs: 0,
    isReady: false,
  };
}
