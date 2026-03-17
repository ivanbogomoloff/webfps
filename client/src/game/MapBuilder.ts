import * as THREE from 'three';
import { MapLoader } from '../utils/MapLoader';
import type { RespawnPoint } from './Map';
import { Map } from './Map';

/** Контекст сборки карты: физика Ammo (после инициализации) и опции отладки. */
export interface MapBuildContext {
  /** Возвращает ammo и physicsWorld после готовности физики. Вызывать в build() до создания тел. */
  getPhysics: () => Promise<{ ammo: any; physicsWorld: any }>;
  debugPhysics: boolean;
  scene: THREE.Scene;
  createPhysicsDebugBox: (size: THREE.Vector3, center: THREE.Vector3) => THREE.Mesh;
}

/**
 * Собирает карту: загружает через MapLoader, добавляет статические тела в Ammo,
 * собирает точки респауна. Результат — Map, из которого можно получить респауны.
 */
export class MapBuilder {
  constructor(private mapLoader: MapLoader) {}

  async build(
    mapPath: string,
    context: MapBuildContext,
    hdrPath?: string
  ): Promise<{ map: Map; physicsDebugRoot: THREE.Group | null }> {
    const { scene: mapScene, environment } = await this.mapLoader.loadMap(mapPath, hdrPath);
    const { getPhysics, debugPhysics, scene, createPhysicsDebugBox } = context;

    const { ammo, physicsWorld } = await getPhysics();

    const respawnPoints: RespawnPoint[] = [];
    let physicsDebugRoot: THREE.Group | null = null;

    if (ammo && physicsWorld) {
      const box = new THREE.Box3();
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();

      if (debugPhysics) {
        physicsDebugRoot = new THREE.Group();
        physicsDebugRoot.name = 'PhysicsDebugBounds';
      }

      mapScene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if ((mesh as any).isMesh) {
          box.setFromObject(mesh);
          box.getSize(size);
          box.getCenter(center);

          const userData = (mesh as any).userData;
          if (userData && userData.respawn === true) {
            respawnPoints.push({ center: center.clone(), size: size.clone() });
          }

          const isRamp = mesh.name != null && mesh.name.startsWith('ramp-');
          let halfExtents: any;
          let transform: any;

          if (isRamp) {
            const geom = mesh.geometry;
            if (!geom.boundingBox) geom.computeBoundingBox();
            const localBox = geom.boundingBox!;
            const localSize = new THREE.Vector3();
            const localCenter = new THREE.Vector3();
            localBox.getSize(localSize);
            localBox.getCenter(localCenter);
            halfExtents = new ammo.btVector3(
              localSize.x / 2,
              localSize.y / 2,
              localSize.z / 2
            );
            const worldCenter = new THREE.Vector3().copy(localCenter).applyMatrix4(mesh.matrixWorld);
            const worldQuat = new THREE.Quaternion();
            mesh.getWorldQuaternion(worldQuat);
            transform = new ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(new ammo.btVector3(worldCenter.x, worldCenter.y, worldCenter.z));
            const btQuat = new ammo.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
            transform.setRotation(btQuat);
            ammo.destroy(btQuat);
          } else {
            halfExtents = new ammo.btVector3(size.x / 2, size.y / 2, size.z / 2);
            transform = new ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(new ammo.btVector3(center.x, center.y, center.z));
          }

          const shape = new ammo.btBoxShape(halfExtents);
          const motionState = new ammo.btDefaultMotionState(transform);
          const mass = 0;
          const localInertia = new ammo.btVector3(0, 0, 0);
          const rbInfo = new ammo.btRigidBodyConstructionInfo(
            mass,
            motionState,
            shape,
            localInertia
          );
          const body = new ammo.btRigidBody(rbInfo);
          physicsWorld.addRigidBody(body);

          if (debugPhysics && physicsDebugRoot) {
            if (isRamp) {
              const worldQuat = new THREE.Quaternion();
              mesh.getWorldQuaternion(worldQuat);
              const geom = mesh.geometry;
              const localBox = geom.boundingBox!;
              const localSize = new THREE.Vector3();
              const localCenter = new THREE.Vector3();
              localBox.getSize(localSize);
              localBox.getCenter(localCenter);
              localCenter.applyMatrix4(mesh.matrixWorld);
              const debugMesh = createPhysicsDebugBox(localSize, localCenter);
              debugMesh.quaternion.copy(worldQuat);
              physicsDebugRoot.add(debugMesh);
            } else {
              const debugMesh = createPhysicsDebugBox(size, center);
              physicsDebugRoot.add(debugMesh);
            }
          }
        }
      });

      if (debugPhysics && physicsDebugRoot) {
        scene.add(physicsDebugRoot);
      }
    }

    const map = new Map(mapScene, respawnPoints, environment);
    return { map, physicsDebugRoot };
  }
}
