export interface AmmoVector3 {
  x(): number;
  y(): number;
  z(): number;
  setValue(x: number, y: number, z: number): void;
}

export interface AmmoTransform {
  setIdentity(): void;
  setOrigin(origin: AmmoVector3): void;
  getOrigin(): AmmoVector3;
}

export interface AmmoMotionState {
  getWorldTransform(transform: AmmoTransform): void;
}

export interface AmmoRigidBody {
  hy?: number;
  getMotionState(): AmmoMotionState | null;
  getLinearVelocity(): AmmoVector3;
  setLinearVelocity(velocity: AmmoVector3): void;
  setWorldTransform(transform: AmmoTransform): void;
  activate(forceActivation?: boolean): void;
}

export interface AmmoRayCallback {
  set_m_closestHitFraction(value: number): void;
  set_m_rayFromWorld(from: AmmoVector3): void;
  set_m_rayToWorld(to: AmmoVector3): void;
  hasHit(): boolean;
}

export interface AmmoManifoldPoint {
  getDistance(): number;
  get_m_normalWorldOnB(): AmmoVector3 | null;
}

export interface AmmoPersistentManifold {
  getBody0(): { hy?: number } | null;
  getBody1(): { hy?: number } | null;
  getNumContacts(): number;
  getContactPoint(index: number): AmmoManifoldPoint | null;
}

export interface AmmoDispatcher {
  getNumManifolds(): number;
  getManifoldByIndexInternal(index: number): AmmoPersistentManifold | null;
}

export interface AmmoWorld {
  setGravity(gravity: AmmoVector3): void;
  getDispatcher(): AmmoDispatcher;
  rayTest(from: AmmoVector3, to: AmmoVector3, callback: AmmoRayCallback): void;
  stepSimulation(deltaTime: number, maxSubSteps: number): void;
  addRigidBody(body: AmmoRigidBody): void;
}

export interface AmmoApi {
  btTransform: new () => AmmoTransform;
  btVector3: new (x: number, y: number, z: number) => AmmoVector3;
  ClosestRayResultCallback: new (from: AmmoVector3, to: AmmoVector3) => AmmoRayCallback;
  btDefaultCollisionConfiguration: new () => unknown;
  btCollisionDispatcher: new (config: unknown) => unknown;
  btDbvtBroadphase: new () => unknown;
  btSequentialImpulseConstraintSolver: new () => unknown;
  btDiscreteDynamicsWorld: new (
    dispatcher: unknown,
    broadphase: unknown,
    solver: unknown,
    config: unknown,
  ) => AmmoWorld;
  btSphereShape: new (radius: number) => { calculateLocalInertia(mass: number, out: AmmoVector3): void };
  btDefaultMotionState: new (transform: AmmoTransform) => AmmoMotionState;
  btRigidBodyConstructionInfo: new (
    mass: number,
    motionState: AmmoMotionState,
    shape: unknown,
    localInertia: AmmoVector3,
  ) => unknown;
  btRigidBody: new (info: unknown) => AmmoRigidBody;
  destroy(value: unknown): void;
}

export interface AmmoBody {
  body: AmmoRigidBody;
}

export function createAmmoBody(body: AmmoRigidBody): AmmoBody {
  return { body };
}
