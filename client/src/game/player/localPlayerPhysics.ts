import type { World } from 'miniplex';
import { createAmmoBody, type AmmoApi, type AmmoWorld } from '../../ecs/components';
import type { LocalPlayerEntity } from './localPlayerFactory';

type AttachLocalPlayerAmmoBodyParams = {
  world: World;
  entity: LocalPlayerEntity;
  playerRadius: number;
  physicsReady: Promise<void>;
  getAmmo: () => AmmoApi | null;
  getPhysicsWorld: () => AmmoWorld | null;
};

export function attachLocalPlayerAmmoBody(params: AttachLocalPlayerAmmoBodyParams): void {
  const {
    world,
    entity,
    playerRadius,
    physicsReady,
    getAmmo,
    getPhysicsWorld,
  } = params;
  void (async () => {
    await physicsReady;
    const ammo = getAmmo();
    const physicsWorld = getPhysicsWorld();
    if (!ammo || !physicsWorld) return;

    const startTransform = new ammo.btTransform();
    startTransform.setIdentity();
    startTransform.setOrigin(new ammo.btVector3(0, 6, 0));

    const shape = new ammo.btSphereShape(playerRadius);
    const mass = 1;
    const localInertia = new ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(mass, localInertia);

    const motionState = new ammo.btDefaultMotionState(startTransform);
    const rbInfo = new ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia,
    );
    const body = new ammo.btRigidBody(rbInfo);

    physicsWorld.addRigidBody(body);
    world.addComponent(entity as unknown as object, 'ammoBody', createAmmoBody(body));
  })();
}
