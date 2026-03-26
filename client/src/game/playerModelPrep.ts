import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const DEFAULT_PLAYER_RADIUS = 0.5;

export type PlayerVisualSetup = {
  visualModel: THREE.Object3D;
  idleClip: THREE.AnimationClip | null;
  walkClip: THREE.AnimationClip | null;
  backwardsClip: THREE.AnimationClip | null;
  leftStClip: THREE.AnimationClip | null;
  rightStClip: THREE.AnimationClip | null;
};

function findAnimationClip(
  animations: THREE.AnimationClip[],
  namePart: string,
): THREE.AnimationClip | undefined {
  const part = namePart.toLowerCase();
  return animations.find((clip) => clip.name.toLowerCase().includes(part));
}

/** Центр по XZ, ноги на высоте -playerRadius (центр сферы коллизии в корне игрока). */
function alignPlayerModelToCapsule(model: THREE.Object3D, playerRadius: number): void {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x = -center.x;
  model.position.z = -center.z;
  model.position.y = -box.min.y - playerRadius;
}

/**
 * Настраивает сцену GLTF для игрока: тени, выравнивание под капсулу, клипы idle/walk и опционально backwards, left_st, right_st.
 */
export function preparePlayerVisualFromGltf(
  gltf: GLTF,
  playerRadius: number = DEFAULT_PLAYER_RADIUS,
): PlayerVisualSetup {
  const model = gltf.scene;
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  alignPlayerModelToCapsule(model, playerRadius);

  let idleClip = findAnimationClip(gltf.animations, 'idle');
  let walkClip = findAnimationClip(gltf.animations, 'walk');
  if ((!idleClip || !walkClip) && gltf.animations.length >= 2) {
    idleClip = idleClip ?? gltf.animations[0];
    walkClip = walkClip ?? gltf.animations[1];
  }

  const backwardsClip = findAnimationClip(gltf.animations, 'backwards') ?? null;
  const leftStClip = findAnimationClip(gltf.animations, 'left_st') ?? null;
  const rightStClip = findAnimationClip(gltf.animations, 'right_st') ?? null;

  if (!idleClip || !walkClip) {
    console.warn(
      '[playerModelPrep] Нужны две анимации (idle/walk по имени или первые два клипа). Найдено:',
      gltf.animations.map((c) => c.name),
    );
  }

  return {
    visualModel: model,
    idleClip: idleClip ?? null,
    walkClip: walkClip ?? null,
    backwardsClip,
    leftStClip,
    rightStClip,
  };
}
