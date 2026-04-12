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
  fireClip: THREE.AnimationClip | null;
  walkFireClip: THREE.AnimationClip | null;
  walkLeftDFireClip: THREE.AnimationClip | null;
  walkRightDFireClip: THREE.AnimationClip | null;
  backwardsFireClip: THREE.AnimationClip | null;
  backwardsLeftDFireClip: THREE.AnimationClip | null;
  backwardsRightDFireClip: THREE.AnimationClip | null;
  leftFireClip: THREE.AnimationClip | null;
  rightFireClip: THREE.AnimationClip | null;
  idleCrouchFireClip: THREE.AnimationClip | null;
  walkCrouchFireClip: THREE.AnimationClip | null;
  walkCrouchLeftDFireClip: THREE.AnimationClip | null;
  walkCrouchRightDFireClip: THREE.AnimationClip | null;
  backwardsCrouchFireClip: THREE.AnimationClip | null;
  backwardsCrouchLeftDFireClip: THREE.AnimationClip | null;
  backwardsCrouchRightDFireClip: THREE.AnimationClip | null;
  leftCrouchFireClip: THREE.AnimationClip | null;
  rightCrouchFireClip: THREE.AnimationClip | null;
  runForwardFireClip: THREE.AnimationClip | null;
  runBackwardFireClip: THREE.AnimationClip | null;
  runLeftFireClip: THREE.AnimationClip | null;
  runRightFireClip: THREE.AnimationClip | null;
  runLeftDFireClip: THREE.AnimationClip | null;
  runRightDFireClip: THREE.AnimationClip | null;
  runBackwardLeftDFireClip: THREE.AnimationClip | null;
  runBackwardRightDFireClip: THREE.AnimationClip | null;
  jumpUpClip: THREE.AnimationClip | null;
  deathBackClip: THREE.AnimationClip | null;
  deathCrouchClip: THREE.AnimationClip | null;
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
  const fireClip =
    findAnimationClip(gltf.animations, 'fire', 'exact') ?? null;
  const walkFireClip =
    findAnimationClip(gltf.animations, 'walk_fire', 'exact') ?? null;
  const walkLeftDFireClip =
    findAnimationClip(gltf.animations, 'walk_left_d_fire', 'exact') ?? null;
  const walkRightDFireClip =
    findAnimationClip(gltf.animations, 'walk_right_d_fire', 'exact') ?? null;
  const backwardsFireClip =
    findAnimationClip(gltf.animations, 'backwards_fire', 'exact') ?? null;
  const backwardsLeftDFireClip =
    findAnimationClip(gltf.animations, 'backwards_left_d_fire', 'exact') ?? null;
  const backwardsRightDFireClip =
    findAnimationClip(gltf.animations, 'backwards_right_d_fire', 'exact') ?? null;
  const leftFireClip =
    findAnimationClip(gltf.animations, 'left_fire', 'exact') ?? null;
  const rightFireClip =
    findAnimationClip(gltf.animations, 'right_fire', 'exact') ?? null;
  const idleCrouchFireClip =
    findAnimationClip(gltf.animations, 'idle_crouch_fire', 'exact') ?? null;
  const walkCrouchFireClip =
    findAnimationClip(gltf.animations, 'walk_crouch_fire', 'exact') ?? null;
  const walkCrouchLeftDFireClip =
    findAnimationClip(gltf.animations, 'walk_crouch_left_d_fire', 'exact') ?? null;
  const walkCrouchRightDFireClip =
    findAnimationClip(gltf.animations, 'walk_crouch_right_d_fire', 'exact') ?? null;
  const backwardsCrouchFireClip =
    findAnimationClip(gltf.animations, 'backwards_crouch_fire', 'exact') ?? null;
  const backwardsCrouchLeftDFireClip =
    findAnimationClip(gltf.animations, 'backwards_crouch_left_d_fire', 'exact') ?? null;
  const backwardsCrouchRightDFireClip =
    findAnimationClip(gltf.animations, 'backwards_crouch_right_d_fire', 'exact') ?? null;
  const leftCrouchFireClip =
    findAnimationClip(gltf.animations, 'left_crouch_fire', 'exact') ?? null;
  const rightCrouchFireClip =
    findAnimationClip(gltf.animations, 'right_crouch_fire', 'exact') ?? null;
  const runForwardFireClip =
    findAnimationClip(gltf.animations, 'run_forward_fire', 'exact') ?? null;
  const runBackwardFireClip =
    findAnimationClip(gltf.animations, 'run_backward_fire', 'exact') ?? null;
  const runLeftFireClip =
    findAnimationClip(gltf.animations, 'run_left_fire', 'exact') ?? null;
  const runRightFireClip =
    findAnimationClip(gltf.animations, 'run_right_fire', 'exact') ?? null;
  const runLeftDFireClip =
    findAnimationClip(gltf.animations, 'run_left_d_fire', 'exact') ?? null;
  const runRightDFireClip =
    findAnimationClip(gltf.animations, 'run_right_d_fire', 'exact') ?? null;
  const runBackwardLeftDFireClip =
    findAnimationClip(gltf.animations, 'run_backward_left_d_fire', 'exact') ?? null;
  const runBackwardRightDFireClip =
    findAnimationClip(gltf.animations, 'run_backward_right_d_fire', 'exact') ?? null;
  const deathBackClip =
    findAnimationClip(gltf.animations, 'death_back', 'exact') ?? null;
  const deathCrouchClip =
    findAnimationClip(gltf.animations, 'death_crouch', 'exact') ?? null;

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
    fireClip,
    walkFireClip,
    walkLeftDFireClip,
    walkRightDFireClip,
    backwardsFireClip,
    backwardsLeftDFireClip,
    backwardsRightDFireClip,
    leftFireClip,
    rightFireClip,
    idleCrouchFireClip,
    walkCrouchFireClip,
    walkCrouchLeftDFireClip,
    walkCrouchRightDFireClip,
    backwardsCrouchFireClip,
    backwardsCrouchLeftDFireClip,
    backwardsCrouchRightDFireClip,
    leftCrouchFireClip,
    rightCrouchFireClip,
    runForwardFireClip,
    runBackwardFireClip,
    runLeftFireClip,
    runRightFireClip,
    runLeftDFireClip,
    runRightDFireClip,
    runBackwardLeftDFireClip,
    runBackwardRightDFireClip,
    jumpUpClip,
    deathBackClip,
    deathCrouchClip,
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
    fireClip: template.fireClip,
    walkFireClip: template.walkFireClip,
    walkLeftDFireClip: template.walkLeftDFireClip,
    walkRightDFireClip: template.walkRightDFireClip,
    backwardsFireClip: template.backwardsFireClip,
    backwardsLeftDFireClip: template.backwardsLeftDFireClip,
    backwardsRightDFireClip: template.backwardsRightDFireClip,
    leftFireClip: template.leftFireClip,
    rightFireClip: template.rightFireClip,
    idleCrouchFireClip: template.idleCrouchFireClip,
    walkCrouchFireClip: template.walkCrouchFireClip,
    walkCrouchLeftDFireClip: template.walkCrouchLeftDFireClip,
    walkCrouchRightDFireClip: template.walkCrouchRightDFireClip,
    backwardsCrouchFireClip: template.backwardsCrouchFireClip,
    backwardsCrouchLeftDFireClip: template.backwardsCrouchLeftDFireClip,
    backwardsCrouchRightDFireClip: template.backwardsCrouchRightDFireClip,
    leftCrouchFireClip: template.leftCrouchFireClip,
    rightCrouchFireClip: template.rightCrouchFireClip,
    runForwardFireClip: template.runForwardFireClip,
    runBackwardFireClip: template.runBackwardFireClip,
    runLeftFireClip: template.runLeftFireClip,
    runRightFireClip: template.runRightFireClip,
    runLeftDFireClip: template.runLeftDFireClip,
    runRightDFireClip: template.runRightDFireClip,
    runBackwardLeftDFireClip: template.runBackwardLeftDFireClip,
    runBackwardRightDFireClip: template.runBackwardRightDFireClip,
    jumpUpClip: template.jumpUpClip,
    deathBackClip: template.deathBackClip,
    deathCrouchClip: template.deathCrouchClip,
  };
}
