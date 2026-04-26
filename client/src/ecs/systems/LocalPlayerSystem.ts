import type { World } from 'miniplex';
import * as THREE from 'three';
import {
  applyWeaponDefinition,
  type AmmoApi,
  type AmmoBody,
  type Health,
  type NetworkIdentity,
  type PlayerController,
  type PlayerPhysicsState,
  type WeaponState,
} from '../components';
import type { AmmoPhysicsContext } from './PhysicsSystem';
import type { RespawnPoint } from '../../game/map/Map';
import { applyWeaponTransformValues, replaceWeaponVisual } from '../../game/weapon/weaponVisualAttach';
import {
  DEFAULT_WEAPON_ID,
  getWeaponFpPoseForAnimation,
  resolveWeaponId,
} from '../../game/weapon/supportedWeaponModels';
import { assignObjectToLayerRecursive, FP_VIEWMODEL_RENDER_LAYER } from '../../game/weapon/viewmodelLayer';

type LocalPlayerEntity = {
  networkIdentity?: NetworkIdentity;
  health?: Health;
  playerController?: PlayerController;
  weaponState?: WeaponState;
  weaponVisualRoot?: THREE.Object3D;
  weaponVisualObject?: THREE.Object3D | null;
  weaponVisualWeaponId?: string;
  weaponVisualFpRoot?: THREE.Object3D;
  weaponVisualFpObject?: THREE.Object3D | null;
  weaponVisualFpWeaponId?: string;
  ammoBody?: AmmoBody;
  object3d?: THREE.Object3D;
  playerPhysicsState?: PlayerPhysicsState;
};

type LocalPlayerSystemDeps = {
  scene: THREE.Scene;
  physicsContext: AmmoPhysicsContext;
  getAmmo: () => AmmoApi | null;
  getRespawns: () => ReadonlyArray<RespawnPoint>;
  getWeaponTemplate: (weaponId: string) => THREE.Object3D | undefined;
};

function getLocalPlayerEntity(world: World): LocalPlayerEntity | null {
  for (const entity of world.with('networkIdentity', 'health', 'playerController', 'weaponState')) {
    const networkIdentity = (entity as LocalPlayerEntity).networkIdentity;
    if (networkIdentity?.isLocal) {
      return entity as LocalPlayerEntity;
    }
  }
  return null;
}

function syncEntityWeaponVisual(entity: LocalPlayerEntity, deps: LocalPlayerSystemDeps): void {
  if (!entity.weaponState) return;
  const resolvedWeaponId = resolveWeaponId(entity.weaponState.weaponId);
  if (entity.weaponState.weaponId !== resolvedWeaponId) {
    applyWeaponDefinition(entity.weaponState, resolvedWeaponId);
  }
  if (entity.networkIdentity) {
    entity.networkIdentity.weaponId = entity.weaponState.weaponId;
  }
  if (entity.weaponVisualWeaponId === resolvedWeaponId && entity.weaponVisualObject) {
    // Keep processing FP slot even when TPS slot is already up to date.
  } else {
    const template = deps.getWeaponTemplate(resolvedWeaponId) ?? deps.getWeaponTemplate(DEFAULT_WEAPON_ID);
    const visualRoot = entity.weaponVisualRoot ?? entity.object3d ?? deps.scene;
    entity.weaponVisualObject = replaceWeaponVisual(
      visualRoot,
      entity.weaponVisualObject,
      template,
    );
    entity.weaponVisualWeaponId = resolvedWeaponId;
  }

  const template = deps.getWeaponTemplate(resolvedWeaponId) ?? deps.getWeaponTemplate(DEFAULT_WEAPON_ID);
  if (entity.weaponVisualFpRoot) {
    if (entity.weaponVisualFpWeaponId !== resolvedWeaponId || !entity.weaponVisualFpObject) {
      entity.weaponVisualFpObject = replaceWeaponVisual(
        entity.weaponVisualFpRoot,
        entity.weaponVisualFpObject,
        template,
      );
      entity.weaponVisualFpWeaponId = resolvedWeaponId;
      if (entity.weaponVisualFpObject) {
        assignObjectToLayerRecursive(entity.weaponVisualFpObject, FP_VIEWMODEL_RENDER_LAYER);
        applyWeaponTransformValues(
          entity.weaponVisualFpObject,
          getWeaponFpPoseForAnimation(resolvedWeaponId, 'idle'),
        );
      }
    }
  }
}

export function placeLocalPlayerAtRandomRespawn(
  entity: LocalPlayerEntity | null,
  physicsContext: AmmoPhysicsContext,
  respawns: ReadonlyArray<RespawnPoint>,
  ammo: AmmoApi | null,
): void {
  const playerBody = entity?.ammoBody?.body ?? null;
  const playerObject3d = entity?.object3d ?? null;
  const physicsTransform = physicsContext.ammoTransform;
  if (!entity || !playerBody || !playerObject3d || !physicsTransform || !ammo || respawns.length === 0) {
    return;
  }

  const point = respawns[Math.floor(Math.random() * respawns.length)];
  const playerRadius = physicsContext.playerRadius;
  const spawnX = point.center.x;
  const spawnY = point.center.y + point.size.y / 2 + playerRadius;
  const spawnZ = point.center.z;

  playerObject3d.position.set(spawnX, spawnY, spawnZ);

  const originVec = new ammo.btVector3(spawnX, spawnY, spawnZ);
  physicsTransform.setIdentity();
  physicsTransform.setOrigin(originVec);
  playerBody.setWorldTransform(physicsTransform);

  const zeroVelocity = new ammo.btVector3(0, 0, 0);
  playerBody.setLinearVelocity(zeroVelocity);

  ammo.destroy(zeroVelocity);
  ammo.destroy(originVec);

  if (entity.playerPhysicsState) {
    entity.playerPhysicsState.isGrounded = true;
    entity.playerPhysicsState.jumpPending = false;
  }
}

export function createLocalPlayerSystem(world: World, deps: LocalPlayerSystemDeps) {
  let previousIsDead = false;

  return (_deltaTime: number) => {
    const localPlayerEntity = getLocalPlayerEntity(world);
    if (!localPlayerEntity) {
      previousIsDead = false;
      return;
    }

    syncEntityWeaponVisual(localPlayerEntity, deps);

    const isDead = localPlayerEntity.health?.isDead ?? false;
    if (!previousIsDead && isDead && localPlayerEntity.playerController) {
      localPlayerEntity.playerController.viewMode = 'third';
    }
    if (previousIsDead && !isDead) {
      placeLocalPlayerAtRandomRespawn(
        localPlayerEntity,
        deps.physicsContext,
        deps.getRespawns(),
        deps.getAmmo(),
      );
      if (localPlayerEntity.playerController) {
        localPlayerEntity.playerController.viewMode = 'first';
      }
    }
    previousIsDead = isDead;

    const viewMode = localPlayerEntity.playerController?.viewMode ?? 'first';
    const weaponAction = localPlayerEntity.weaponState?.action ?? 'walk';
    const fpWeaponVisible = viewMode === 'first' && weaponAction !== 'hide';
    if (localPlayerEntity.weaponVisualRoot) {
      localPlayerEntity.weaponVisualRoot.visible = viewMode !== 'first';
    }
    if (localPlayerEntity.weaponVisualFpRoot) {
      localPlayerEntity.weaponVisualFpRoot.visible = fpWeaponVisible;
    }
  };
}
