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

interface CollisionPhysicsCtx {
  ammo: any;
  physicsWorld: any;
  debugPhysics: boolean;
  physicsDebugRoot: THREE.Group | null;
  createPhysicsDebugBox: (size: THREE.Vector3, center: THREE.Vector3) => THREE.Mesh;
}

/**
 * Собирает карту: загружает через MapLoader, добавляет статические тела в Ammo,
 * собирает точки респауна. Результат — Map, из которого можно получить респауны.
 */
export class MapBuilder {
  constructor(private mapLoader: MapLoader) {}

  private createRampPhysicsBody(mesh: THREE.Mesh, ctx: CollisionPhysicsCtx): boolean {
    const { ammo, physicsWorld, debugPhysics, physicsDebugRoot } = ctx;
    const geom = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geom.attributes.position;
    if (!posAttr) return false;

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
      return false;
    }
    hullShape.setMargin(0.01);

    const worldCenter = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const worldQuat = new THREE.Quaternion();
    mesh.getWorldQuaternion(worldQuat);
    const transform = new ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new ammo.btVector3(worldCenter.x, worldCenter.y, worldCenter.z));
    const btQuat = new ammo.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
    transform.setRotation(btQuat);
    ammo.destroy(btQuat);

    const motionState = new ammo.btDefaultMotionState(transform);
    const mass = 0;
    const localInertia = new ammo.btVector3(0, 0, 0);
    const rbInfo = new ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      hullShape,
      localInertia
    );
    const body = new ammo.btRigidBody(rbInfo);
    physicsWorld.addRigidBody(body);

    if (debugPhysics && physicsDebugRoot) {
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
    }
    return true;
  }

  /**
   * Локальные радиус (в плоскости XZ) и половина высоты (ось Y) для btCylinderShape,
   * в единицах мирового масштаба вдоль осей меша.
   */
  private getCylinderShapeExtents(
    mesh: THREE.Mesh,
    geom: THREE.BufferGeometry
  ): { radius: number; halfHeight: number } {
    const worldScale = new THREE.Vector3();
    mesh.getWorldScale(worldScale);
    const sx = Math.abs(worldScale.x);
    const sy = Math.abs(worldScale.y);
    const sz = Math.abs(worldScale.z);

    if (geom.type === 'CylinderGeometry') {
      const p = (geom as THREE.CylinderGeometry).parameters;
      const r = Math.max(p.radiusTop, p.radiusBottom);
      return {
        radius: r * Math.max(sx, sz),
        halfHeight: (p.height / 2) * sy,
      };
    }

    if (!geom.boundingBox) geom.computeBoundingBox();
    const localSize = new THREE.Vector3();
    geom.boundingBox!.getSize(localSize);
    const rx = (localSize.x / 2) * sx;
    const rz = (localSize.z / 2) * sz;
    return {
      radius: Math.max(rx, rz),
      halfHeight: (localSize.y / 2) * sy,
    };
  }

  private createCylinderPhysicsBody(mesh: THREE.Mesh, ctx: CollisionPhysicsCtx): void {
    const { ammo, physicsWorld, debugPhysics, physicsDebugRoot } = ctx;

    const geom = mesh.geometry as THREE.BufferGeometry;
    const { radius, halfHeight } = this.getCylinderShapeExtents(mesh, geom);

    const halfExtents = new ammo.btVector3(radius, halfHeight, radius);
    const shape = new ammo.btCylinderShape(halfExtents);

    const worldCenter = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const worldQuat = new THREE.Quaternion();
    mesh.getWorldQuaternion(worldQuat);
    const transform = new ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new ammo.btVector3(worldCenter.x, worldCenter.y, worldCenter.z));
    const btQuat = new ammo.btQuaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
    transform.setRotation(btQuat);
    ammo.destroy(btQuat);

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
      const debugGeom = new THREE.CylinderGeometry(radius, radius, halfHeight * 2, 24, 1, true);
      const debugMesh = new THREE.Mesh(
        debugGeom,
        new THREE.MeshBasicMaterial({ wireframe: true, color: 0x00ff00, depthTest: true })
      );
      debugMesh.position.copy(worldCenter);
      debugMesh.quaternion.copy(worldQuat);
      debugMesh.name = 'PhysicsDebugCylinder';
      physicsDebugRoot.add(debugMesh);
    }
  }

  private createBoxPhysicsBody(
    size: THREE.Vector3,
    center: THREE.Vector3,
    ctx: CollisionPhysicsCtx
  ): void {
    const { ammo, physicsWorld, debugPhysics, physicsDebugRoot, createPhysicsDebugBox } = ctx;

    const halfExtents = new ammo.btVector3(size.x / 2, size.y / 2, size.z / 2);
    const shape = new ammo.btBoxShape(halfExtents);
    const transform = new ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new ammo.btVector3(center.x, center.y, center.z));

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
      const debugMesh = createPhysicsDebugBox(size, center);
      physicsDebugRoot.add(debugMesh);
    }
  }

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

          const isCollision =
            (mesh.name != null && mesh.name.startsWith('collision')) ||
            (userData && userData.collider === true);
          if (!isCollision) return;

          if (mesh.name != null && mesh.name.startsWith('collision')) {
            mesh.visible = false;
          }

          const physicsCtx: CollisionPhysicsCtx = {
            ammo,
            physicsWorld,
            debugPhysics,
            physicsDebugRoot,
            createPhysicsDebugBox,
          };

          const name = mesh.name ?? '';
          const isCylinder = name.toLowerCase().includes('cylinder');
          const isRamp = name.startsWith('collision_ramp');

          if (isCylinder) {
            this.createCylinderPhysicsBody(mesh, physicsCtx);
          } else if (isRamp) {
            this.createRampPhysicsBody(mesh, physicsCtx);
          } else {
            this.createBoxPhysicsBody(size, center, physicsCtx);
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
