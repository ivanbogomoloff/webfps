import type { World } from 'miniplex';
import type { CollisionVolume, BoundsXZ } from '../../../game/map/Map';
import { buildBotNavGraph } from '../../../game/bot/BotNavBuilder';
import type { BotNavGraphData } from '../../../game/bot/types';
import type { AmmoPhysicsContext } from '../PhysicsSystem';
import { createBotNavGraph } from '../../components/bot/BotNavGraph';
import type { NetworkContext } from '../../../net/NetworkContext';

export type BotNavBuildContext = {
  mapId: string;
  collisionVolumes: ReadonlyArray<CollisionVolume>;
  boundsXZ: BoundsXZ;
  physicsContext: AmmoPhysicsContext;
  getNavEntity: () => { botNavGraph: ReturnType<typeof createBotNavGraph> } | null;
  setNavEntity: (entity: { botNavGraph: ReturnType<typeof createBotNavGraph> }) => void;
  networkContext: NetworkContext | null;
};

let pendingBuild: Promise<BotNavGraphData | null> | null = null;

export async function ensureBotNavGraph(ctx: BotNavBuildContext): Promise<BotNavGraphData | null> {
  const existing = ctx.getNavEntity()?.botNavGraph;
  if (existing?.isReady && existing.mapId === ctx.mapId && existing.waypoints.length > 0) {
    return existing;
  }

  if (pendingBuild) return pendingBuild;

  pendingBuild = (async () => {
    const graph = buildBotNavGraph({
      mapId: ctx.mapId,
      boundsXZ: ctx.boundsXZ,
      collisionVolumes: ctx.collisionVolumes,
      physicsContext: ctx.physicsContext,
    });

    let navEntity = ctx.getNavEntity();
    if (!navEntity) {
      navEntity = { botNavGraph: createBotNavGraph(ctx.mapId) };
      ctx.setNavEntity(navEntity);
    }

    navEntity.botNavGraph = {
      ...graph,
      isReady: graph.waypoints.length > 0,
    };

    if (ctx.networkContext?.isRoomOwner() && navEntity.botNavGraph.isReady) {
      ctx.networkContext.sendBotNavSubmit({
        mapId: graph.mapId,
        waypoints: graph.waypoints,
        edges: graph.edges,
      });
    }

    console.log(
      `[BotNav] Built ${graph.waypoints.length} waypoints, ${graph.edges.length} edges for map ${ctx.mapId}`,
    );
    return graph;
  })();

  try {
    return await pendingBuild;
  } finally {
    pendingBuild = null;
  }
}

export function invalidateBotNavCache(): void {
  pendingBuild = null;
}

export function createBotNavBuildSystem(_world: World, _ctx: BotNavBuildContext) {
  return (_deltaTime: number) => {
    // Nav is built explicitly via ensureBotNavGraph from Game.loadMap / addBot.
  };
}
