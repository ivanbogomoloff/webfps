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

          const isCollision = mesh.name != null && mesh.name.startsWith('collision');
          if (!isCollision) return;

          mesh.visible = false;

          const isRamp = mesh.name.startsWith('collision_ramp');
          let shape: any;
          let transform: any;

          if (isRamp) {
            const geom = mesh.geometry as THREE.BufferGeometry;
            const posAttr = geom.attributes.position;
            if (!posAttr) return;
            const positions = posAttr.array as Float32Array;
            const indexAttr = geom.index;
            const seen = new Set<string>();

            const hullShape = new ammo.btConvexHullShape();
            const v = new ammo.btVector3(0, 0, 0);

            const addVertex = (i: number) => {
              const key = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`;
              if (seen.has(key)) return;
              seen.add(key);
              v.setValue(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
              hullShape.addPoint(v);
            };

            if (indexAttr) {
              const indices = indexAttr.array;
              for (let i = 0; i < indices.length; i++) addVertex(indices[i]);
            } else {
              for (let i = 0; i < posAttr.count; i++) addVertex(i);
            }
            ammo.destroy(v);

            if (hullShape.getNumVertices() < 4) {
              ammo.destroy(hullShape);
              return;
            }
            hullShape.setMargin(0.01);
            shape = hullShape;

            const worldCenter = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
            const worldQuat = new THREE.Quaternion();
            mesh.getWorldQuaternion(worldQuat);
            transform = new ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(new ammo.btVector3(worldCenter.x, worldCenter.y, worldCenter.z));
            const btQuat = new ammo.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
            transform.setRotation(btQuat);
            ammo.destroy(btQuat);
          } else {
            const halfExtents = new ammo.btVector3(size.x / 2, size.y / 2, size.z / 2);
            shape = new ammo.btBoxShape(halfExtents);
            transform = new ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(new ammo.btVector3(center.x, center.y, center.z));
          }

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
              const debugMesh = mesh.clone();
              debugMesh.visible = true;
              debugMesh.position.setFromMatrixPosition(mesh.matrixWorld);
              mesh.getWorldQuaternion(debugMesh.quaternion);
              debugMesh.scale.setFromMatrixScale(mesh.matrixWorld);
              debugMesh.material = new THREE.MeshBasicMaterial({
                wireframe: true,
                color: 0x00ff00,
              });
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
