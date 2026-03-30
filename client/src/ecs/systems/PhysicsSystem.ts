import { World } from 'miniplex';
import * as THREE from 'three';
import type {
  AmmoApi,
  AmmoRayCallback,
  AmmoRigidBody,
  AmmoTransform,
  AmmoVector3,
  AmmoWorld,
  AmmoBody,
} from '../components/AmmoBody';
import type { NetworkIdentity, PlayerController, PlayerPhysicsState } from '../components';

export type GroundProbeDebugState = {
  x: number;
  y: number;
  z: number;
  fromY: number;
  toY: number;
  hit: boolean;
};

export type AmmoPhysicsContext = {
  ammo: AmmoApi | null;
  physicsWorld: AmmoWorld | null;
  ammoTransform: AmmoTransform | null;
  groundRayFrom: AmmoVector3 | null;
  groundRayTo: AmmoVector3 | null;
  groundRayCallback: AmmoRayCallback | null;
  playerRadius: number;
  jumpSpeed: number;
  groundRayMargin: number;
  groundRayLength: number;
  lastGroundProbe: GroundProbeDebugState;
};

export function createAmmoPhysicsContext(): AmmoPhysicsContext {
  return {
    ammo: null,
    physicsWorld: null,
    ammoTransform: null,
    groundRayFrom: null,
    groundRayTo: null,
    groundRayCallback: null,
    playerRadius: 0.5,
    jumpSpeed: 3.8,
    groundRayMargin: 0.05,
    groundRayLength: 0.38,
    lastGroundProbe: {
      x: 0,
      y: 0,
      z: 0,
      fromY: 0,
      toY: 0,
      hit: false,
    },
  };
}

export function attachAmmoRuntimeToPhysicsContext(
  context: AmmoPhysicsContext,
  ammo: AmmoApi,
  physicsWorld: AmmoWorld,
): void {
  context.ammo = ammo;
  context.physicsWorld = physicsWorld;
  context.ammoTransform = new ammo.btTransform();
  context.groundRayFrom = new ammo.btVector3(0, 0, 0);
  context.groundRayTo = new ammo.btVector3(0, -1, 0);
  context.groundRayCallback = new ammo.ClosestRayResultCallback(
    context.groundRayFrom,
    context.groundRayTo,
  );
}

function probeGrounded(
  context: AmmoPhysicsContext,
  worldX: number,
  worldY: number,
  worldZ: number,
): boolean {
  if (
    !context.physicsWorld ||
    !context.groundRayFrom ||
    !context.groundRayTo ||
    !context.groundRayCallback
  ) {
    return false;
  }
  const r = context.playerRadius;
  const margin = context.groundRayMargin;
  const y0 = worldY - r + margin;
  const y1 = y0 - (margin + context.groundRayLength);
  context.lastGroundProbe.x = worldX;
  context.lastGroundProbe.y = worldY;
  context.lastGroundProbe.z = worldZ;
  context.lastGroundProbe.fromY = y0;
  context.lastGroundProbe.toY = y1;
  context.groundRayFrom.setValue(worldX, y0, worldZ);
  context.groundRayTo.setValue(worldX, y1, worldZ);
  context.groundRayCallback.set_m_closestHitFraction(1);
  context.groundRayCallback.set_m_rayFromWorld(context.groundRayFrom);
  context.groundRayCallback.set_m_rayToWorld(context.groundRayTo);
  context.physicsWorld.rayTest(context.groundRayFrom, context.groundRayTo, context.groundRayCallback);
  const hit = context.groundRayCallback.hasHit();
  context.lastGroundProbe.hit = hit;
  return hit;
}

function isBodyGroundedByContacts(context: AmmoPhysicsContext, playerBody: AmmoRigidBody): boolean {
  if (!context.physicsWorld || !playerBody) return false;
  const dispatcher = context.physicsWorld.getDispatcher();
  if (!dispatcher) return false;

  const playerPtr = (playerBody as { hy?: number }).hy;
  if (playerPtr == null) return false;

  const manifolds = dispatcher.getNumManifolds?.() ?? 0;
  for (let i = 0; i < manifolds; i += 1) {
    const manifold = dispatcher.getManifoldByIndexInternal(i);
    if (!manifold) continue;
    const body0 = manifold.getBody0?.();
    const body1 = manifold.getBody1?.();
    const isBody0Player = !!body0 && (body0 as { hy?: number }).hy === playerPtr;
    const isBody1Player = !!body1 && (body1 as { hy?: number }).hy === playerPtr;
    if (!isBody0Player && !isBody1Player) continue;

    const contacts = manifold.getNumContacts?.() ?? 0;
    for (let j = 0; j < contacts; j += 1) {
      const point = manifold.getContactPoint?.(j);
      if (!point) continue;
      if ((point.getDistance?.() ?? 1) > 0.02) continue;
      const normal = point.get_m_normalWorldOnB?.();
      if (!normal) continue;
      const ny = normal.y?.() ?? 0;
      const supportUp = isBody0Player ? ny : -ny;
      if (supportUp > 0.45) {
        return true;
      }
    }
  }
  return false;
}

type LocalPhysicsEntity = {
  ammoBody?: AmmoBody;
  playerPhysicsState?: PlayerPhysicsState;
  object3d?: THREE.Object3D;
  playerController?: PlayerController;
  networkIdentity?: NetworkIdentity;
};

function pickLocalBodyEntity(world: World): LocalPhysicsEntity | null {
  for (const entity of world.with('ammoBody', 'playerPhysicsState', 'object3d', 'networkIdentity')) {
    const ni = (entity as LocalPhysicsEntity).networkIdentity;
    if (ni?.isLocal) return entity as LocalPhysicsEntity;
  }
  return null;
}

export function createPhysicsSystem(world: World, context: AmmoPhysicsContext) {
  return (deltaTime: number) => {
    if (!context.physicsWorld || !context.ammo || !context.ammoTransform) return;

    const local = pickLocalBodyEntity(world);

    if (local?.ammoBody && local.playerPhysicsState) {
      let vx = 0;
      let vz = 0;
      const body = local.ammoBody.body;
      const physicsState = local.playerPhysicsState;

      const motionState = body.getMotionState?.();
      let px = 0;
      let py = 0;
      let pz = 0;
      if (motionState) {
        motionState.getWorldTransform(context.ammoTransform);
        const origin = context.ammoTransform.getOrigin();
        px = origin.x();
        py = origin.y();
        pz = origin.z();
      }

      probeGrounded(context, px, py, pz);
      const groundedForJump = isBodyGroundedByContacts(context, body);

      if (physicsState.moveDirection && local.playerController) {
        const dir = physicsState.moveDirection;
        const speed = local.playerController.speed ?? 5;
        vx = dir.x * speed;
        vz = dir.z * speed;
      }

      const currentVel = body.getLinearVelocity();
      let vy = currentVel.y();
      if (physicsState.jumpPending && groundedForJump) {
        vy = context.jumpSpeed;
      }
      physicsState.jumpPending = false;

      body.activate?.(true);
      const newVel = new context.ammo.btVector3(vx, vy, vz);
      body.setLinearVelocity(newVel);
      context.ammo.destroy(newVel);
    }

    context.physicsWorld.stepSimulation(deltaTime, 10);

    if (local?.ammoBody && local.playerPhysicsState && local.object3d) {
      const body = local.ammoBody.body;
      const motionState = body.getMotionState?.();
      if (motionState) {
        motionState.getWorldTransform(context.ammoTransform);
        const origin = context.ammoTransform.getOrigin();
        local.object3d.position.set(origin.x(), origin.y(), origin.z());
        probeGrounded(context, origin.x(), origin.y(), origin.z());
        local.playerPhysicsState.isGrounded = isBodyGroundedByContacts(context, body);
      }
    }
  };
}
