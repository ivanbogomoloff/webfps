import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const DEFAULT_PLAYER_RADIUS = 0.5;

export type PlayerVisualSetup = {
  visualModel: THREE.Object3D;
  idleClip: THREE.AnimationClip | null;
  walkClip: THREE.AnimationClip | null;
  backwardsClip: THREE.AnimationClip | null;
  walkLeftDClip: THREE.AnimationClip | null;
  walkRightDClip: THREE.AnimationClip | null;
  left: THREE.AnimationClip | null;
  right: THREE.AnimationClip | null;
};

function findAnimationClip(
  animations: THREE.AnimationClip[],
  namePart: string,
  match: 'includes' | 'exact' = 'includes',
): THREE.AnimationClip | undefined {
  const part = namePart.toLowerCase();
  if (match === 'exact') {
    return animations.find((clip) => clip.name.trim().toLowerCase() === part);
  }
  return animations.find((clip) => clip.name.toLowerCase().includes(part));
}

const WALK_DIAGONAL_EXACT = new Set(['walk_left_d', 'walk_right_d']);

/** Прямой walk: сначала точное имя walk, иначе подстрока «walk», но не диагональные клипы. */
function findForwardWalkClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | undefined {
  const exact = findAnimationClip(animations, 'walk', 'exact');
  if (exact) return exact;
  return animations.find((clip) => {
    const n = clip.name.trim().toLowerCase();
    return n.includes('walk') && !WALK_DIAGONAL_EXACT.has(n);
  });
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
 * Настраивает сцену GLTF для игрока: тени, выравнивание под капсулу, клипы idle/walk и опционально backwards.
 * Клип «прямого» ходьбы не путается с walk_left_d / walk_right_d при поиске по подстроке walk.
 * Стрейф left/right и walk_left_d / walk_right_d — по точному имени клипа (не подстрока), чтобы не подхватить варианты вроде left_crouch.
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
  let walkClip = findForwardWalkClip(gltf.animations);
  if ((!idleClip || !walkClip) && gltf.animations.length >= 2) {
    idleClip = idleClip ?? gltf.animations[0];
    walkClip = walkClip ?? gltf.animations[1];
  }

  const backwardsClip = findAnimationClip(gltf.animations, 'backwards') ?? null;
  const walkLeftDClip =
    findAnimationClip(gltf.animations, 'walk_left_d', 'exact') ?? null;
  const walkRightDClip =
    findAnimationClip(gltf.animations, 'walk_right_d', 'exact') ?? null;
  const leftClip = findAnimationClip(gltf.animations, 'left', 'exact') ?? null;
  const rightClip = findAnimationClip(gltf.animations, 'right', 'exact') ?? null;

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
    walkLeftDClip,
    walkRightDClip,
    left: leftClip,
    right: rightClip,
  };
}
