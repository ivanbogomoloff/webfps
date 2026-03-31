import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const DEFAULT_PLAYER_RADIUS = 0.5;

export type PlayerVisualSetup = {
  visualModel: THREE.Object3D;
  idleClip: THREE.AnimationClip | null;
  walkClip: THREE.AnimationClip | null;
  backwardsClip: THREE.AnimationClip | null;
  walkLeftDClip: THREE.AnimationClip | null;
  walkRightDClip: THREE.AnimationClip | null;
  backwardsLeftDClip: THREE.AnimationClip | null;
  backwardsRightDClip: THREE.AnimationClip | null;
  left: THREE.AnimationClip | null;
  right: THREE.AnimationClip | null;
  idleCrouchClip: THREE.AnimationClip | null;
  walkCrouchClip: THREE.AnimationClip | null;
  walkCrouchLeftDClip: THREE.AnimationClip | null;
  walkCrouchRightDClip: THREE.AnimationClip | null;
  backwardsCrouchClip: THREE.AnimationClip | null;
  backwardsCrouchLeftDClip: THREE.AnimationClip | null;
  backwardsCrouchRightDClip: THREE.AnimationClip | null;
  leftCrouchClip: THREE.AnimationClip | null;
  rightCrouchClip: THREE.AnimationClip | null;
  runForwardClip: THREE.AnimationClip | null;
  runBackwardClip: THREE.AnimationClip | null;
  runLeftClip: THREE.AnimationClip | null;
  runRightClip: THREE.AnimationClip | null;
  runLeftDClip: THREE.AnimationClip | null;
  runRightDClip: THREE.AnimationClip | null;
  runBackwardLeftDClip: THREE.AnimationClip | null;
  runBackwardRightDClip: THREE.AnimationClip | null;
  jumpUpClip: THREE.AnimationClip | null;
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

const BACKWARDS_DIAGONAL_EXACT = new Set(['backwards_left_d', 'backwards_right_d']);

/** Прямой backwards: точное backwards или подстрока, но не backwards_*_d диагонали. */
function findBackwardClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | undefined {
  const exact = findAnimationClip(animations, 'backwards', 'exact');
  if (exact) return exact;
  return animations.find((clip) => {
    const n = clip.name.trim().toLowerCase();
    return n.includes('backwards') && !BACKWARDS_DIAGONAL_EXACT.has(n);
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
 * Клип «прямого» walk/backwards не путается с диагональными *_left_d / *_right_d при поиске по подстроке.
 * Стрейф, walk_*, backwards_* диагонали — по точному имени, где нужно (не подстрока), чтобы не подхватить варианты вроде left_crouch.
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

  const backwardsClip = findBackwardClip(gltf.animations) ?? null;
  const backwardsLeftDClip =
    findAnimationClip(gltf.animations, 'backwards_left_d', 'exact') ?? null;
  const backwardsRightDClip =
    findAnimationClip(gltf.animations, 'backwards_right_d', 'exact') ?? null;
  const walkLeftDClip =
    findAnimationClip(gltf.animations, 'walk_left_d', 'exact') ?? null;
  const walkRightDClip =
    findAnimationClip(gltf.animations, 'walk_right_d', 'exact') ?? null;
  const leftClip = findAnimationClip(gltf.animations, 'left', 'exact') ?? null;
  const rightClip = findAnimationClip(gltf.animations, 'right', 'exact') ?? null;
  const jumpUpClip =
    findAnimationClip(gltf.animations, 'jump_up', 'exact') ?? null;
  const idleCrouchClip =
    findAnimationClip(gltf.animations, 'idle_crouch', 'exact') ?? null;
  const walkCrouchClip =
    findAnimationClip(gltf.animations, 'walk_crouch', 'exact') ?? null;
  const walkCrouchLeftDClip =
    findAnimationClip(gltf.animations, 'walk_crouch_left_d', 'exact') ?? null;
  const walkCrouchRightDClip =
    findAnimationClip(gltf.animations, 'walk_crouch_right_d', 'exact') ?? null;
  const backwardsCrouchClip =
    findAnimationClip(gltf.animations, 'backwards_crouch', 'exact') ?? null;
  const backwardsCrouchLeftDClip =
    findAnimationClip(gltf.animations, 'backwards_crouch_left_d', 'exact') ?? null;
  const backwardsCrouchRightDClip =
    findAnimationClip(gltf.animations, 'backwards_crouch_right_d', 'exact') ?? null;
  const leftCrouchClip =
    findAnimationClip(gltf.animations, 'left_crouch', 'exact') ?? null;
  const rightCrouchClip =
    findAnimationClip(gltf.animations, 'right_crouch', 'exact') ?? null;
  const runForwardClip =
    findAnimationClip(gltf.animations, 'run_forward', 'exact') ?? null;
  const runBackwardClip =
    findAnimationClip(gltf.animations, 'run_backward', 'exact') ?? null;
  const runLeftClip =
    findAnimationClip(gltf.animations, 'run_left', 'exact') ?? null;
  const runRightClip =
    findAnimationClip(gltf.animations, 'run_right', 'exact') ?? null;
  const runLeftDClip =
    findAnimationClip(gltf.animations, 'run_left_d', 'exact') ?? null;
  const runRightDClip =
    findAnimationClip(gltf.animations, 'run_right_d', 'exact') ?? null;
  const runBackwardLeftDClip =
    findAnimationClip(gltf.animations, 'run_backward_left_d', 'exact') ?? null;
  const runBackwardRightDClip =
    findAnimationClip(gltf.animations, 'run_backward_right_d', 'exact') ?? null;

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
    backwardsLeftDClip,
    backwardsRightDClip,
    left: leftClip,
    right: rightClip,
    idleCrouchClip,
    walkCrouchClip,
    walkCrouchLeftDClip,
    walkCrouchRightDClip,
    backwardsCrouchClip,
    backwardsCrouchLeftDClip,
    backwardsCrouchRightDClip,
    leftCrouchClip,
    rightCrouchClip,
    runForwardClip,
    runBackwardClip,
    runLeftClip,
    runRightClip,
    runLeftDClip,
    runRightDClip,
    runBackwardLeftDClip,
    runBackwardRightDClip,
    jumpUpClip,
  };
}

/** Клон сцены для второго экземпляра игрока; клипы анимаций переиспользуются с новым микшером. */
export function clonePlayerVisualSetup(template: PlayerVisualSetup): PlayerVisualSetup {
  return {
    visualModel: SkeletonUtils.clone(template.visualModel) as THREE.Object3D,
    idleClip: template.idleClip,
    walkClip: template.walkClip,
    backwardsClip: template.backwardsClip,
    walkLeftDClip: template.walkLeftDClip,
    walkRightDClip: template.walkRightDClip,
    backwardsLeftDClip: template.backwardsLeftDClip,
    backwardsRightDClip: template.backwardsRightDClip,
    left: template.left,
    right: template.right,
    idleCrouchClip: template.idleCrouchClip,
    walkCrouchClip: template.walkCrouchClip,
    walkCrouchLeftDClip: template.walkCrouchLeftDClip,
    walkCrouchRightDClip: template.walkCrouchRightDClip,
    backwardsCrouchClip: template.backwardsCrouchClip,
    backwardsCrouchLeftDClip: template.backwardsCrouchLeftDClip,
    backwardsCrouchRightDClip: template.backwardsCrouchRightDClip,
    leftCrouchClip: template.leftCrouchClip,
    rightCrouchClip: template.rightCrouchClip,
    runForwardClip: template.runForwardClip,
    runBackwardClip: template.runBackwardClip,
    runLeftClip: template.runLeftClip,
    runRightClip: template.runRightClip,
    runLeftDClip: template.runLeftDClip,
    runRightDClip: template.runRightDClip,
    runBackwardLeftDClip: template.runBackwardLeftDClip,
    runBackwardRightDClip: template.runBackwardRightDClip,
    jumpUpClip: template.jumpUpClip,
  };
}
