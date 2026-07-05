import type { World } from 'miniplex';
import { BOT_NAV_CONFIG } from '../../../config/botConfig';
import {
  buildCandidatesFromPlayers,
  stepBotCombat,
} from '../../../game/bot/BotCombatBrain';
import {
  stepBotCombatMovement,
  stepBotMovement,
} from '../../../game/bot/BotMovementBrain';
import { distance3 } from '../../../game/bot/collisionQueries';
import type { AmmoPhysicsContext } from '../PhysicsSystem';

type AnyEntity = Record<string, any>;

export function createBotAISystem(
  world: World,
  options: {
    physicsContext: AmmoPhysicsContext;
    getAllPlayerStates: () => Array<{
      playerId: string;
      x: number;
      y: number;
      z: number;
      isDead: boolean;
    }>;
  },
) {
  const botQuery = world.with('botIdentity', 'botAgentState');
  const navQuery = world.with('botNavGraph');
  let tickAccumulator = 0;
  const tickInterval = 1 / BOT_NAV_CONFIG.botTickHz;

  return (deltaTime: number) => {
    tickAccumulator += deltaTime;
    if (tickAccumulator < tickInterval) return;
    tickAccumulator = 0;

    let navEntity: AnyEntity | undefined;
    for (const entity of navQuery) {
      navEntity = entity as AnyEntity;
      break;
    }
    const navGraph = navEntity?.botNavGraph;
    if (!navGraph?.isReady) return;

    const graph = {
      mapId: navGraph.mapId,
      waypoints: navGraph.waypoints,
      edges: navGraph.edges,
      builtAtMs: navGraph.builtAtMs,
    };
    const nowMs = Date.now();

    for (const entity of botQuery) {
      const bot = entity as AnyEntity;
      if (!bot.botAgentState || !bot.networkTransform) continue;
      if (bot.health?.isDead) continue;

      const agent = bot.botAgentState;
      let x = bot.networkTransform.x;
      let y = bot.networkTransform.y;
      let z = bot.networkTransform.z;
      let rotY = bot.networkTransform.rotY;

      if (agent.predictedX !== 0 || agent.predictedY !== 0 || agent.predictedZ !== 0) {
        x = agent.predictedX;
        y = agent.predictedY;
        z = agent.predictedZ;
        rotY = agent.predictedRotY;
      } else {
        agent.predictedX = x;
        agent.predictedY = y;
        agent.predictedZ = z;
        agent.predictedRotY = rotY;
      }

      const localCandidates = buildCandidatesFromPlayers(
        options.getAllPlayerStates(),
        x,
        y,
        z,
      );
      const combat = stepBotCombat({
        botId: bot.botIdentity.playerId,
        x,
        y,
        z,
        rotY,
        state: agent.combat,
        candidates: localCandidates,
        nowMs,
      });

      let movement;
      if (combat.targetId) {
        const target = localCandidates.find((c) => c.playerId === combat.targetId);
        if (target) {
          movement = stepBotCombatMovement({
            x,
            y,
            z,
            rotY: combat.rotY,
            targetX: target.x,
            targetZ: target.z,
            deltaTime: tickInterval,
          });
        } else {
          movement = stepBotMovement({
            graph,
            physicsContext: options.physicsContext,
            x,
            y,
            z,
            rotY,
            state: agent.movement,
            deltaTime: tickInterval,
          });
        }
      } else {
        movement = stepBotMovement({
          graph,
          physicsContext: options.physicsContext,
          x,
          y,
          z,
          rotY,
          state: agent.movement,
          deltaTime: tickInterval,
        });
      }

      agent.predictedX = movement.x;
      agent.predictedY = movement.y;
      agent.predictedZ = movement.z;
      agent.predictedRotY = combat.targetId ? combat.rotY : movement.rotY;
      agent.targetId = combat.targetId;
      agent.waypointIndex = movement.waypointIndex;
      agent.path = movement.path;

      const serverX = bot.networkTransform.x;
      const serverZ = bot.networkTransform.z;
      bot.botDebugDelta = distance3(agent.predictedX, agent.predictedY, agent.predictedZ, serverX, bot.networkTransform.y, serverZ);
    }
  };
}
