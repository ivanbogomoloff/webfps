import type { World } from 'miniplex';
import * as THREE from 'three';
import { getWeaponCrosshairConfig } from '../../config/weaponCatalog';
import type {
  Health,
  NetworkIdentity,
  PlayerController,
  WeaponAction,
  WeaponState,
} from '../components';
import type { WeaponCrosshairConfig } from '../../config/weapons/types';
import { DEFAULT_WEAPON_ID } from '../../game/weapon/supportedWeaponModels';
import { FP_VIEWMODEL_RENDER_LAYER } from '../../game/weapon/viewmodelLayer';

const CROSSHAIR_MAX_PULSE = 1.4;
const CROSSHAIR_SHOT_HOLD_EPSILON = 1e-4;

type LocalCrosshairEntity = {
  networkIdentity: NetworkIdentity;
  health: Health;
  playerController: PlayerController;
  weaponState: WeaponState;
};

type RenderSystemOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
};

function findLocalCrosshairEntity(world: World): LocalCrosshairEntity | null {
  for (const entity of world.with('networkIdentity', 'health', 'playerController', 'weaponState')) {
    const local = entity as unknown as LocalCrosshairEntity;
    if (local.networkIdentity.isLocal) return local;
  }
  return null;
}

function updateCrosshairViewport(
  renderer: THREE.WebGLRenderer,
  camera: THREE.OrthographicCamera,
  cachedSize: THREE.Vector2,
): void {
  const viewportSize = renderer.getSize(cachedSize);
  const width = viewportSize.x;
  const height = viewportSize.y;
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}

export function createRenderSystem(world: World, options: RenderSystemOptions) {
  const { renderer, scene, camera } = options;
  const crosshairScene = new THREE.Scene();
  const crosshairCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  crosshairCamera.position.z = 5;
  const crosshairRoot = new THREE.Group();
  crosshairRoot.renderOrder = 1000;
  crosshairRoot.frustumCulled = false;
  const crosshairMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffff'),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
  });
  crosshairScene.add(crosshairRoot);

  const viewportSize = new THREE.Vector2();
  updateCrosshairViewport(renderer, crosshairCamera, viewportSize);

  let crosshairArms: THREE.Mesh[] = [];
  let crosshairWeaponId: string | null = null;
  let crosshairBaseScale = 1;
  let crosshairShotPulseScale = 0.2;
  let crosshairPulseDecayPerSec = 8;
  let crosshairPulse = 0;
  let crosshairLastAction: WeaponAction = 'walk';
  let crosshairLastActionHoldSec = 0;

  const rebuildCrosshairArms = (config: WeaponCrosshairConfig) => {
    for (const arm of crosshairArms) {
      crosshairRoot.remove(arm);
      arm.geometry.dispose();
    }
    crosshairArms = [];

    const horizontalGeometry = new THREE.PlaneGeometry(config.armLengthPx, config.armThicknessPx);
    const verticalGeometry = new THREE.PlaneGeometry(config.armThicknessPx, config.armLengthPx);
    const offset = config.gapPx + config.armLengthPx / 2;
    const placements = [
      { geometry: horizontalGeometry, x: offset, y: 0 },
      { geometry: horizontalGeometry.clone(), x: -offset, y: 0 },
      { geometry: verticalGeometry, x: 0, y: offset },
      { geometry: verticalGeometry.clone(), x: 0, y: -offset },
    ] as const;

    for (const placement of placements) {
      const arm = new THREE.Mesh(placement.geometry, crosshairMaterial);
      arm.position.set(placement.x, placement.y, 0);
      arm.renderOrder = 1000;
      arm.frustumCulled = false;
      crosshairRoot.add(arm);
      crosshairArms.push(arm);
    }
  };

  const configureCrosshair = (config: WeaponCrosshairConfig & { weaponId: string }) => {
    if (crosshairWeaponId === config.weaponId) return;
    crosshairWeaponId = config.weaponId;
    crosshairMaterial.color.set(config.color);
    crosshairBaseScale = Math.max(0.2, config.baseScale);
    crosshairShotPulseScale = Math.max(0.02, config.shotPulseScale);
    crosshairPulseDecayPerSec = Math.max(0.5, config.pulseDecayPerSec);
    rebuildCrosshairArms(config);
  };

  configureCrosshair(getWeaponCrosshairConfig(DEFAULT_WEAPON_ID));

  const updateCrosshairState = (deltaTime: number) => {
    const local = findLocalCrosshairEntity(world);
    if (!local) {
      crosshairRoot.visible = false;
      crosshairPulse = 0;
      return;
    }

    configureCrosshair(getWeaponCrosshairConfig(local.weaponState.weaponId));
    const showCrosshair =
      local.networkIdentity.role === 'player' &&
      !local.health.isDead &&
      local.playerController.viewMode === 'first';
    crosshairRoot.visible = showCrosshair;
    if (!showCrosshair) {
      crosshairPulse = 0;
    }

    const action = local.weaponState.action;
    const actionHoldSec = local.weaponState.actionHoldSec;
    const firedShot =
      action === 'fire' &&
      (crosshairLastAction !== 'fire' ||
        actionHoldSec > crosshairLastActionHoldSec + CROSSHAIR_SHOT_HOLD_EPSILON);
    if (showCrosshair && firedShot) {
      crosshairPulse = Math.min(
        CROSSHAIR_MAX_PULSE,
        crosshairPulse + crosshairShotPulseScale,
      );
    }
    crosshairPulse = Math.max(0, crosshairPulse - crosshairPulseDecayPerSec * deltaTime);

    const pulseScale = crosshairBaseScale * (1 + crosshairPulse);
    crosshairRoot.scale.setScalar(pulseScale);
    crosshairLastAction = action;
    crosshairLastActionHoldSec = actionHoldSec;
  };

  return (deltaTime: number) => {
    updateCrosshairViewport(renderer, crosshairCamera, viewportSize);
    updateCrosshairState(deltaTime);

    const previousMask = camera.layers.mask;
    const previousAutoClear = renderer.autoClear;

    camera.layers.mask = previousMask & ~(1 << FP_VIEWMODEL_RENDER_LAYER);
    renderer.autoClear = true;
    renderer.render(scene, camera);

    renderer.autoClear = false;
    renderer.clearDepth();
    const previousBackground = scene.background;
    scene.background = null;
    camera.layers.mask = 1 << FP_VIEWMODEL_RENDER_LAYER;
    renderer.render(scene, camera);
    scene.background = previousBackground;

    camera.layers.mask = previousMask;
    renderer.autoClear = previousAutoClear;

    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(crosshairScene, crosshairCamera);
    renderer.autoClear = previousAutoClear;
  };
}
