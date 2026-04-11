import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  DEFAULT_PLAYER_RADIUS,
  preparePlayerVisualFromGltf,
  type PlayerVisualSetup,
} from './playerModelPrep';
import {
  DEFAULT_PLAYER_MODEL_ID,
  playerModelGltfPath,
  SUPPORTED_PLAYER_MODEL_IDS,
  type SupportedPlayerModelId,
} from './supportedPlayerModels';

function emptyPlayerVisualSetup(): PlayerVisualSetup {
  return {
    visualModel: new THREE.Group(),
    idleClip: null,
    walkClip: null,
    backwardsClip: null,
    walkLeftDClip: null,
    walkRightDClip: null,
    backwardsLeftDClip: null,
    backwardsRightDClip: null,
    left: null,
    right: null,
    idleCrouchClip: null,
    walkCrouchClip: null,
    walkCrouchLeftDClip: null,
    walkCrouchRightDClip: null,
    backwardsCrouchClip: null,
    backwardsCrouchLeftDClip: null,
    backwardsCrouchRightDClip: null,
    leftCrouchClip: null,
    rightCrouchClip: null,
    runForwardClip: null,
    runBackwardClip: null,
    runLeftClip: null,
    runRightClip: null,
    runLeftDClip: null,
    runRightDClip: null,
    runBackwardLeftDClip: null,
    runBackwardRightDClip: null,
    fireClip: null,
    walkFireClip: null,
    walkLeftDFireClip: null,
    walkRightDFireClip: null,
    backwardsFireClip: null,
    backwardsLeftDFireClip: null,
    backwardsRightDFireClip: null,
    leftFireClip: null,
    rightFireClip: null,
    idleCrouchFireClip: null,
    walkCrouchFireClip: null,
    walkCrouchLeftDFireClip: null,
    walkCrouchRightDFireClip: null,
    backwardsCrouchFireClip: null,
    backwardsCrouchLeftDFireClip: null,
    backwardsCrouchRightDFireClip: null,
    leftCrouchFireClip: null,
    rightCrouchFireClip: null,
    runForwardFireClip: null,
    runBackwardFireClip: null,
    runLeftFireClip: null,
    runRightFireClip: null,
    runLeftDFireClip: null,
    runRightDFireClip: null,
    runBackwardLeftDFireClip: null,
    runBackwardRightDFireClip: null,
    jumpUpClip: null,
  };
}

/** Загружает по одному шаблону на каждый поддерживаемый model id (для клонирования на удалённых игроков). */
export async function loadSupportedPlayerModelTemplates(): Promise<
  Map<SupportedPlayerModelId, PlayerVisualSetup>
> {
  const loader = new GLTFLoader();
  const map = new Map<SupportedPlayerModelId, PlayerVisualSetup>();

  for (const id of SUPPORTED_PLAYER_MODEL_IDS) {
    try {
      const gltf = await loader.loadAsync(playerModelGltfPath(id));
      map.set(id, preparePlayerVisualFromGltf(gltf, DEFAULT_PLAYER_RADIUS));
    } catch (error) {
      console.error(`[playerModelTemplates] Не удалось загрузить модель ${id}:`, error);
      map.set(id, emptyPlayerVisualSetup());
    }
  }

  if (!map.has(DEFAULT_PLAYER_MODEL_ID)) {
    map.set(DEFAULT_PLAYER_MODEL_ID, emptyPlayerVisualSetup());
  }

  return map;
}
