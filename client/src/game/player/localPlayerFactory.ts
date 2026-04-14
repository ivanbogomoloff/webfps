import type { World } from 'miniplex';
import * as THREE from 'three';
import {
  createAudioEmitterState,
  createHealth,
  createInput,
  createNetworkIdentity,
  createNetworkTransform,
  createPlayerAnimation,
  createPlayerController,
  createPlayerPhysicsState,
  createPlayerStats,
  createWeaponState,
  type AmmoBody,
  type AudioEmitterState,
  type Health,
  type NetworkIdentity,
  type PlayerController,
  type PlayerPhysicsState,
  type WeaponState,
} from '../../ecs/components';
import type { PlayerVisualSetup } from './playerModelPrep';
import { DEFAULT_WEAPON_ID, resolveWeaponId } from '../weapon/supportedWeaponModels';

export type LocalPlayerEntity = {
  id: number;
  input: ReturnType<typeof createInput>;
  camera: THREE.PerspectiveCamera;
  object3d: THREE.Object3D;
  health: Health;
  networkIdentity: NetworkIdentity;
  playerController: PlayerController;
  playerPhysicsState: PlayerPhysicsState;
  audioEmitterState: AudioEmitterState;
  weaponState: WeaponState;
  weaponVisualRoot?: THREE.Object3D;
  weaponVisualObject?: THREE.Object3D | null;
  weaponVisualWeaponId?: string;
  ammoBody?: AmmoBody;
};

type LocalPlayerFactoryParams = {
  world: World;
  camera: THREE.PerspectiveCamera;
  setup: PlayerVisualSetup;
  localNickname?: string;
  localModelId?: string;
  localWeaponId?: string;
  createEntity: <T extends Record<string, unknown>>(components: T) => T & { id: number };
};

type SetupWithCoreClips = PlayerVisualSetup & {
  idleClip: THREE.AnimationClip;
  walkClip: THREE.AnimationClip;
};

function hasCoreClips(setup: PlayerVisualSetup): setup is SetupWithCoreClips {
  return setup.idleClip != null && setup.walkClip != null;
}

function buildPlayerAnimationClips(setup: SetupWithCoreClips) {
  return {
    idle: setup.idleClip,
    walk: setup.walkClip,
    walk_left_d: setup.walkLeftDClip,
    walk_right_d: setup.walkRightDClip,
    backwards: setup.backwardsClip,
    backwards_left_d: setup.backwardsLeftDClip,
    backwards_right_d: setup.backwardsRightDClip,
    left: setup.left,
    right: setup.right,
    idle_crouch: setup.idleCrouchClip,
    walk_crouch: setup.walkCrouchClip,
    walk_crouch_left_d: setup.walkCrouchLeftDClip,
    walk_crouch_right_d: setup.walkCrouchRightDClip,
    backwards_crouch: setup.backwardsCrouchClip,
    backwards_crouch_left_d: setup.backwardsCrouchLeftDClip,
    backwards_crouch_right_d: setup.backwardsCrouchRightDClip,
    left_crouch: setup.leftCrouchClip,
    right_crouch: setup.rightCrouchClip,
    run_forward: setup.runForwardClip,
    run_backward: setup.runBackwardClip,
    run_left: setup.runLeftClip,
    run_right: setup.runRightClip,
    run_left_d: setup.runLeftDClip,
    run_right_d: setup.runRightDClip,
    run_backward_left_d: setup.runBackwardLeftDClip,
    run_backward_right_d: setup.runBackwardRightDClip,
    fire: setup.fireClip,
    walk_fire: setup.walkFireClip,
    walk_left_d_fire: setup.walkLeftDFireClip,
    walk_right_d_fire: setup.walkRightDFireClip,
    backwards_fire: setup.backwardsFireClip,
    backwards_left_d_fire: setup.backwardsLeftDFireClip,
    backwards_right_d_fire: setup.backwardsRightDFireClip,
    left_fire: setup.leftFireClip,
    right_fire: setup.rightFireClip,
    idle_crouch_fire: setup.idleCrouchFireClip,
    walk_crouch_fire: setup.walkCrouchFireClip,
    walk_crouch_left_d_fire: setup.walkCrouchLeftDFireClip,
    walk_crouch_right_d_fire: setup.walkCrouchRightDFireClip,
    backwards_crouch_fire: setup.backwardsCrouchFireClip,
    backwards_crouch_left_d_fire: setup.backwardsCrouchLeftDFireClip,
    backwards_crouch_right_d_fire: setup.backwardsCrouchRightDFireClip,
    left_crouch_fire: setup.leftCrouchFireClip,
    right_crouch_fire: setup.rightCrouchFireClip,
    run_forward_fire: setup.runForwardFireClip,
    run_backward_fire: setup.runBackwardFireClip,
    run_left_fire: setup.runLeftFireClip,
    run_right_fire: setup.runRightFireClip,
    run_left_d_fire: setup.runLeftDFireClip,
    run_right_d_fire: setup.runRightDFireClip,
    run_backward_left_d_fire: setup.runBackwardLeftDFireClip,
    run_backward_right_d_fire: setup.runBackwardRightDFireClip,
    jump_up: setup.jumpUpClip,
    death_back: setup.deathBackClip,
    death_crouch: setup.deathCrouchClip,
  };
}

export function createLocalPlayerEntity(params: LocalPlayerFactoryParams): LocalPlayerEntity {
  const {
    world,
    camera,
    setup,
    localNickname,
    localModelId,
    localWeaponId,
    createEntity,
  } = params;
  const playerRoot = new THREE.Group();
  playerRoot.position.set(0, 6, 0);
  playerRoot.add(setup.visualModel);
  const initialWeaponId = resolveWeaponId(localWeaponId ?? DEFAULT_WEAPON_ID);

  const entity = createEntity({
    input: createInput(),
    camera,
    object3d: playerRoot,
    health: createHealth(100),
    networkTransform: createNetworkTransform(),
    networkIdentity: createNetworkIdentity(
      'pending-local',
      localNickname ?? 'Player',
      localModelId ?? 'player1',
      initialWeaponId,
      true,
      'spectator'
    ),
    playerStats: createPlayerStats(),
    playerController: createPlayerController(5, 0.003),
    playerPhysicsState: createPlayerPhysicsState(),
    audioEmitterState: createAudioEmitterState(),
    weaponState: createWeaponState(initialWeaponId),
    weaponVisualRoot: setup.visualModel,
    weaponVisualObject: null as THREE.Object3D | null,
    weaponVisualWeaponId: '' as string,
  }) as LocalPlayerEntity;

  if (hasCoreClips(setup)) {
    // Miniplex: addComponent гарантирует попадание сущности в query по компоненту.
    world.addComponent(
      entity as any,
      'playerAnimation',
      createPlayerAnimation(setup.visualModel, buildPlayerAnimationClips(setup)),
    );
  }

  return entity;
}
