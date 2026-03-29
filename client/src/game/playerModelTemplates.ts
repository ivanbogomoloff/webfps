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
