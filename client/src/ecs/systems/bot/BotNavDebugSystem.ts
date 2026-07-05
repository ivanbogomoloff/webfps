import type { World } from 'miniplex';
import * as THREE from 'three';

type AnyEntity = Record<string, any>;

export function createBotNavDebugSystem(
  world: World,
  scene: THREE.Scene,
  enabled: boolean,
) {
  const navQuery = world.with('botNavGraph');
  let debugRoot: THREE.Group | null = null;
  let lastBuiltAtMs = 0;

  return (_deltaTime: number) => {
    if (!enabled) {
      if (debugRoot) {
        scene.remove(debugRoot);
        debugRoot = null;
        lastBuiltAtMs = 0;
      }
      return;
    }

    let navEntity: AnyEntity | undefined;
    for (const entity of navQuery) {
      navEntity = entity as AnyEntity;
      break;
    }
    const nav = navEntity?.botNavGraph;
    if (!nav?.isReady) return;
    if (nav.builtAtMs === lastBuiltAtMs && debugRoot) return;

    if (debugRoot) {
      scene.remove(debugRoot);
      debugRoot.clear();
    }

    debugRoot = new THREE.Group();
    debugRoot.name = 'BotNavDebug';

    const sphereGeom = new THREE.SphereGeometry(0.25, 8, 8);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true });
    for (const wp of nav.waypoints) {
      const mesh = new THREE.Mesh(sphereGeom, sphereMat);
      mesh.position.set(wp.x, wp.y, wp.z);
      debugRoot.add(mesh);
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x44ff88 });
    for (const edge of nav.edges) {
      const a = nav.waypoints[edge.from];
      const b = nav.waypoints[edge.to];
      if (!a || !b) continue;
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y + 0.2, a.z),
        new THREE.Vector3(b.x, b.y + 0.2, b.z),
      ]);
      debugRoot.add(new THREE.Line(geom, lineMat));
    }

    scene.add(debugRoot);
    lastBuiltAtMs = nav.builtAtMs;
  };
}
