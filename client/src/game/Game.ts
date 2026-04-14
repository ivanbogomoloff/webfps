import * as THREE from 'three';
import Stats from 'stats.js';
import { World } from 'miniplex';

import {
  applyWeaponDefinition,
  createAmmoBody,
  createAudioEmitterState,
  createCamera,
  createInput,
  createHealth,
  createMatchState,
  createNetworkIdentity,
  createNetworkTransform,
  createPlayerController,
  createPlayerAnimation,
  createPlayerPhysicsState,
  createPlayerStats,
  createWeaponState,
} from '../ecs/components';
import {
  attachAmmoRuntimeToPhysicsContext,
  createAmmoPhysicsContext,
  createAudioSystem,
  createLocalPlayerSystem,
  createMatchRulesClientSystem,
  createNetworkReceiveSystem,
  createNetworkSendSystem,
  placeLocalPlayerAtRandomRespawn,
  createShotSendSystem,
  createPhysicsSystem,
  createRenderSystem,
  createRemoteInterpolationSystem,
  createHudSystem,
  createInputSystem,
  createPlayerControllerSystem,
  createPlayerAnimationSystem,
  createWeaponPoseByLocomotionSystem,
  createWeaponLoadoutSystem,
} from '../ecs/systems';
import type {
  AmmoBody,
  AmmoApi,
  AmmoWorld,
  Health,
  NetworkIdentity,
  AudioEmitterState,
  PlayerController,
  PlayerViewMode,
  PlayerPhysicsState,
  WeaponState,
} from '../ecs/components';
import type { AmmoPhysicsContext, GroundProbeDebugState } from '../ecs/systems/PhysicsSystem';
import type { GameTransport } from '../net/GameTransport';
import { NetworkContext } from '../net/NetworkContext';
import type { PlayerRole, ScoreboardPlayer } from '../net/protocol';
import { MapLoader } from '../utils/MapLoader';
import { MapBuilder } from './MapBuilder';
import type { RespawnPoint } from './Map';
import type { PlayerVisualSetup } from './playerModelPrep';
import {
  DEFAULT_PLAYER_MODEL_ID,
  resolvePlayerModelId,
  type SupportedPlayerModelId,
} from './supportedPlayerModels';
import {
  DEFAULT_WEAPON_ID,
  resolveWeaponId,
  type SupportedWeaponId,
} from './supportedWeaponModels';

/** Включить отрисовку границ физических тел карты (Ammo). Задаётся через VITE_DEBUG_PHYSICS=true в .env */
const DEBUG_PHYSICS = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_PHYSICS === 'true';

type LocalPlayerEntity = {
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

export class Game {
  private world: World;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private systems: Array<(deltaTime: number) => void> = [];
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private mapLoader: MapLoader;
  private mapBuilder: MapBuilder;
  private currentMap: THREE.Group | null = null;
  private currentRespawns: ReadonlyArray<RespawnPoint> = [];
  /** Группа с wireframe-боксами границ физических тел карты (только при VITE_DEBUG_PHYSICS=true) */
  private physicsDebugRoot: THREE.Group | null = null;
  private statsJs: Stats;
  private ammo: AmmoApi | null = null;
  private physicsWorld: AmmoWorld | null = null;
  private ammoCollisionConfig: unknown;
  private ammoDispatcher: unknown;
  private ammoBroadphase: unknown;
  private ammoSolver: unknown;
  private physicsReady: Promise<void>;
  private physicsContext: AmmoPhysicsContext = createAmmoPhysicsContext();
  private localPlayerEntity: LocalPlayerEntity | null = null;
  private matchEntity: { id: number; matchState: ReturnType<typeof createMatchState>; scoreboard: ScoreboardPlayer[] } | null = null;
  private networkContext: NetworkContext | null = null;
  private hudSystemAttached = false;

  constructor(
    private readonly options?: {
      transport?: GameTransport;
      localNickname?: string;
      localModelId?: string;
      localWeaponId?: string;
      /** Шаблоны GLB по `SupportedPlayerModelId` — для визуала удалённых игроков. */
      playerModelTemplates?: Map<SupportedPlayerModelId, PlayerVisualSetup>;
      /** Шаблоны GLB по `SupportedWeaponId` — для визуала оружия. */
      weaponModelTemplates?: Map<SupportedWeaponId, THREE.Object3D>;
    }
  ) {
    this.statsJs = new Stats();
    this.statsJs.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    this.statsJs.dom.setAttribute('id', 'statsjs');
    this.statsJs.dom.setAttribute('style', '');
    document.body.appendChild( this.statsJs.dom );

    // Инициализируем Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Небесно-голубой цвет

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Инициализируем MapLoader и MapBuilder
    this.mapLoader = new MapLoader();
    this.mapBuilder = new MapBuilder(this.mapLoader);

    // Инициализируем ECS World
    this.world = new World();

    // Инициализируем Ammo.js физику (асинхронно)
    this.physicsReady = this.initPhysics();

    // Получаем камеру для трёхмерной сцены
    const cameraComponent = createCamera(
      50,
      window.innerWidth / window.innerHeight
    );
    this.camera = cameraComponent.camera;
    this.camera.position.set(0, 1.6, 8);
    this.camera.lookAt(0, 1.6, -5); // Смотрим вперед!
    this.scene.add(this.camera);

    // Инициализируем системы (порядок важен!)
    this.systems.push(createInputSystem(this.world)); // Сначала обновляем ввод
    this.systems.push(
      createPlayerControllerSystem(
        this.world,
        this.renderer.domElement,
      )
    ); // Потом обрабатываем управление
    this.systems.push(createWeaponLoadoutSystem(this.world));
    this.matchEntity = this.createEntity({
      matchState: createMatchState(),
      scoreboard: [] as ScoreboardPlayer[],
    });
    if (this.options?.transport) {
      const templateMap = this.options.playerModelTemplates;
      const weaponTemplateMap = this.options.weaponModelTemplates;
      this.networkContext = new NetworkContext(
        this.options.transport,
        templateMap?.size
          ? {
              getPlayerVisualTemplate: (modelId: string) => {
                const id = resolvePlayerModelId(modelId);
                return templateMap.get(id) ?? templateMap.get(DEFAULT_PLAYER_MODEL_ID);
              },
              getWeaponVisualTemplate: (weaponId: string) => {
                if (!weaponTemplateMap?.size) return undefined;
                const id = resolveWeaponId(weaponId);
                return weaponTemplateMap.get(id) ?? weaponTemplateMap.get(DEFAULT_WEAPON_ID);
              },
            }
          : undefined,
      );
      this.networkContext.start();
      this.systems.push(createNetworkReceiveSystem(this.world, this.scene, this.networkContext));
      this.systems.push(createRemoteInterpolationSystem(this.world));
      this.systems.push(createMatchRulesClientSystem(this.world));
      this.systems.push(createShotSendSystem(this.world, this.networkContext));
      this.systems.push(createNetworkSendSystem(this.world, this.networkContext));
    }
    this.systems.push(
      createLocalPlayerSystem(this.world, {
        scene: this.scene,
        physicsContext: this.physicsContext,
        getAmmo: () => this.ammo,
        getRespawns: () => this.currentRespawns,
        getWeaponTemplate: (weaponId: string) => {
          const map = this.options?.weaponModelTemplates;
          if (!map?.size) return undefined;
          const resolvedId = resolveWeaponId(weaponId);
          return map.get(resolvedId) ?? map.get(DEFAULT_WEAPON_ID);
        },
      }),
    );
    // После сетевого приёма: у соперников `playerController.locomotion` уже из пакета.
    this.systems.push(createPlayerAnimationSystem(this.world));
    this.systems.push(createWeaponPoseByLocomotionSystem(this.world));
    this.systems.push(createPhysicsSystem(this.world, this.physicsContext));
    this.systems.push(createAudioSystem(this.world, this.camera));
    this.systems.push(createRenderSystem(this.world, this.scene)); // В конце рендеринг

    // Обработка изменения размера окна
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private async initPhysics(): Promise<void> {
    // Ammo загружается через <script> в index.html и даёт глобальный Ammo (сначала Promise, после resolve — API)
    const AmmoGlobal = (typeof window !== 'undefined' ? window : (globalThis as any)) as any;
    if (!AmmoGlobal.Ammo) {
      console.error('AmmoPhysics: Ammo.js not loaded. Include ammo.wasm.js script before the app.');
      return;
    }
    const ammo = (await AmmoGlobal.Ammo()) as AmmoApi;
    this.ammo = ammo;

    this.ammoCollisionConfig = new ammo.btDefaultCollisionConfiguration();
    this.ammoDispatcher = new ammo.btCollisionDispatcher(this.ammoCollisionConfig);
    this.ammoBroadphase = new ammo.btDbvtBroadphase();
    this.ammoSolver = new ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new ammo.btDiscreteDynamicsWorld(
      this.ammoDispatcher,
      this.ammoBroadphase,
      this.ammoSolver,
      this.ammoCollisionConfig
    );
    this.physicsWorld.setGravity(new ammo.btVector3(0, -9.8, 0));
    attachAmmoRuntimeToPhysicsContext(
      this.physicsContext,
      ammo,
      this.physicsWorld,
    );
  }

  public createEntity<T extends Record<string, unknown>>(components: T): T & { id: number } {
    const entity: T & { id: number } = { id: Math.random(), ...components };
    this.world.add(entity);

    if ('object3d' in entity && entity.object3d instanceof THREE.Object3D) {
      this.scene.add(entity.object3d);
    }

    return entity;
  }

  /**
   * Создаёт сущность игрока и физическое тело. Визуал и клипы анимаций готовятся снаружи (см. main.ts).
   */
  public createPlayer(setup: PlayerVisualSetup, playerRadius: number = 0.5): void {
    const {
      visualModel,
      idleClip,
      walkClip,
      backwardsClip,
      walkLeftDClip,
      walkRightDClip,
      backwardsLeftDClip,
      backwardsRightDClip,
      left,
      right,
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
    } = setup;
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0, 6, 0);
    playerRoot.add(visualModel);
    const initialWeaponId = resolveWeaponId(this.options?.localWeaponId ?? DEFAULT_WEAPON_ID);

    const entity = this.createEntity({
      input: createInput(),
      camera: this.camera,
      object3d: playerRoot,
      health: createHealth(100),
      networkTransform: createNetworkTransform(),
      networkIdentity: createNetworkIdentity(
        'pending-local',
        this.options?.localNickname ?? 'Player',
        this.options?.localModelId ?? 'player1',
        initialWeaponId,
        true,
        'spectator'
      ),
      playerStats: createPlayerStats(),
      playerController: createPlayerController(5, 0.003), // 5 м/с скорость, чувствительность мыши
      playerPhysicsState: createPlayerPhysicsState(),
      audioEmitterState: createAudioEmitterState(),
      weaponState: createWeaponState(initialWeaponId),
      weaponVisualRoot: visualModel,
      weaponVisualObject: null as THREE.Object3D | null,
      weaponVisualWeaponId: '' as string,
    });

    this.physicsContext.playerRadius = playerRadius;
    this.localPlayerEntity = entity;
    this.networkContext?.setLocalPlayerEntity(entity);

    if (idleClip && walkClip) {
      // Miniplex: нельзя просто присвоить entity.playerAnimation — сущность не попадёт в query
      this.world.addComponent(
        entity as any,
        'playerAnimation',
        createPlayerAnimation(visualModel, {
          idle: idleClip,
          walk: walkClip,
          walk_left_d: walkLeftDClip,
          walk_right_d: walkRightDClip,
          backwards: backwardsClip,
          backwards_left_d: backwardsLeftDClip,
          backwards_right_d: backwardsRightDClip,
          left,
          right,
          idle_crouch: idleCrouchClip,
          walk_crouch: walkCrouchClip,
          walk_crouch_left_d: walkCrouchLeftDClip,
          walk_crouch_right_d: walkCrouchRightDClip,
          backwards_crouch: backwardsCrouchClip,
          backwards_crouch_left_d: backwardsCrouchLeftDClip,
          backwards_crouch_right_d: backwardsCrouchRightDClip,
          left_crouch: leftCrouchClip,
          right_crouch: rightCrouchClip,
          run_forward: runForwardClip,
          run_backward: runBackwardClip,
          run_left: runLeftClip,
          run_right: runRightClip,
          run_left_d: runLeftDClip,
          run_right_d: runRightDClip,
          run_backward_left_d: runBackwardLeftDClip,
          run_backward_right_d: runBackwardRightDClip,
          fire: fireClip,
          walk_fire: walkFireClip,
          walk_left_d_fire: walkLeftDFireClip,
          walk_right_d_fire: walkRightDFireClip,
          backwards_fire: backwardsFireClip,
          backwards_left_d_fire: backwardsLeftDFireClip,
          backwards_right_d_fire: backwardsRightDFireClip,
          left_fire: leftFireClip,
          right_fire: rightFireClip,
          idle_crouch_fire: idleCrouchFireClip,
          walk_crouch_fire: walkCrouchFireClip,
          walk_crouch_left_d_fire: walkCrouchLeftDFireClip,
          walk_crouch_right_d_fire: walkCrouchRightDFireClip,
          backwards_crouch_fire: backwardsCrouchFireClip,
          backwards_crouch_left_d_fire: backwardsCrouchLeftDFireClip,
          backwards_crouch_right_d_fire: backwardsCrouchRightDFireClip,
          left_crouch_fire: leftCrouchFireClip,
          right_crouch_fire: rightCrouchFireClip,
          run_forward_fire: runForwardFireClip,
          run_backward_fire: runBackwardFireClip,
          run_left_fire: runLeftFireClip,
          run_right_fire: runRightFireClip,
          run_left_d_fire: runLeftDFireClip,
          run_right_d_fire: runRightDFireClip,
          run_backward_left_d_fire: runBackwardLeftDFireClip,
          run_backward_right_d_fire: runBackwardRightDFireClip,
          jump_up: jumpUpClip,
          death_back: deathBackClip,
          death_crouch: deathCrouchClip,
        }),
      );
    }

    // Добавляем игрока в физический мир Ammo как динамическое тело
    (async () => {
      await this.physicsReady;
      if (!this.ammo || !this.physicsWorld) return;

      const startTransform = new this.ammo.btTransform();
      startTransform.setIdentity();
      startTransform.setOrigin(new this.ammo.btVector3(0, 6, 0));

      const shape = new this.ammo.btSphereShape(playerRadius);
      const mass = 1;
      const localInertia = new this.ammo.btVector3(0, 0, 0);
      shape.calculateLocalInertia(mass, localInertia);

      const motionState = new this.ammo.btDefaultMotionState(startTransform);
      const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
        mass,
        motionState,
        shape,
        localInertia
      );
      const body = new this.ammo.btRigidBody(rbInfo);

      this.physicsWorld.addRigidBody(body);
      this.world.addComponent(entity as unknown as object, 'ammoBody', createAmmoBody(body));
    })();
  }

  public async loadMap(mapPath: string, hdrPath?: string): Promise<void> {
    try {
      console.log(`Loading map: ${mapPath}`);

      if (this.currentMap) {
        this.scene.remove(this.currentMap);
      }
      this.currentRespawns = [];
      if (this.physicsDebugRoot) {
        this.scene.remove(this.physicsDebugRoot);
        this.physicsDebugRoot = null;
      }

      const { map, physicsDebugRoot } = await this.mapBuilder.build(mapPath, {
        getPhysics: async () => {
          await this.physicsReady;
          if (!this.ammo || !this.physicsWorld) {
            throw new Error('Physics not initialized');
          }
          return { ammo: this.ammo, physicsWorld: this.physicsWorld };
        },
        debugPhysics: DEBUG_PHYSICS,
        scene: this.scene,
        createPhysicsDebugBox: (size, center) => this.createPhysicsDebugBox(size, center),
      }, hdrPath);

      this.currentMap = map.scene;
      this.currentRespawns = map.getRespawns();
      this.scene.add(map.scene);
      if (physicsDebugRoot) {
        this.physicsDebugRoot = physicsDebugRoot;
        if (DEBUG_PHYSICS) {
          console.log('[DEBUG] Physics bounds visible (VITE_DEBUG_PHYSICS=true)');
        }
      }

      placeLocalPlayerAtRandomRespawn(
        this.localPlayerEntity,
        this.physicsContext,
        this.currentRespawns,
        this.ammo,
      );

      if (map.environment) {
        this.scene.environment = map.environment;
        this.scene.background = map.environment;
      }

      console.log(`Map loaded successfully: ${mapPath}`);
    } catch (error) {
      console.error(`Failed to load map: ${mapPath}`, error);
      throw error;
    }
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate();
  }

  private animate = (): void => {
    this.statsJs.begin();
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Выполняем все системы
    for (const system of this.systems) {
      system(deltaTime);
    }

    // Рендерим сцену
    this.renderer.render(this.scene, this.camera);

    this.statsJs.end();
  };

  /** Рисует wireframe-бокс для отладки границ физического тела (карта). */
  private createPhysicsDebugBox(size: THREE.Vector3, center: THREE.Vector3): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      depthTest: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.name = 'PhysicsDebugBox';
    return mesh;
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public stop(): void {
    this.isRunning = false;
    this.networkContext?.stop();
    void this.options?.transport?.disconnect();
  }

  public getWorld(): World {
    return this.world;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public setLocalRole(role: PlayerRole): void {
    if (this.localPlayerEntity?.networkIdentity) {
      this.localPlayerEntity.networkIdentity.role = role;
    }
    this.networkContext?.setRole(role);
  }

  public requestSpawn(): void {
    this.networkContext?.requestSpawn();
  }

  public addBot(): void {
    this.networkContext?.addBot();
  }

  public canAddBot(): boolean {
    return this.networkContext?.canAddBot() ?? false;
  }

  public debugHitSelf(): void {
    this.networkContext?.debugHitSelf();
  }

  public reportKill(victimPlayerId: string): void {
    this.networkContext?.reportKill(victimPlayerId);
  }

  public setLocalWeaponId(weaponId: string): void {
    if (!this.localPlayerEntity) return;
    applyWeaponDefinition(this.localPlayerEntity.weaponState, weaponId);
    this.localPlayerEntity.networkIdentity.weaponId = this.localPlayerEntity.weaponState.weaponId;
  }

  public getScoreboard(): ScoreboardPlayer[] {
    return this.networkContext?.scoreboard ?? [];
  }

  public getLastNetworkError(): string | null {
    return this.networkContext?.lastError ?? null;
  }

  public getMatchState(): {
    phase: string;
    timeLimitSec: number;
    timeLeftSec: number;
    fragLimit: number;
    winnerPlayerId: string | null;
    maxPlayers: number;
  } | null {
    if (!this.matchEntity?.matchState) return null;
    return this.matchEntity.matchState;
  }

  public getRoomCode(): string | null {
    return this.options?.transport?.getRoomCode() ?? null;
  }

  public getViewMode(): PlayerViewMode {
    return this.localPlayerEntity?.playerController?.viewMode ?? 'first';
  }

  public setViewMode(mode: PlayerViewMode): void {
    if (!this.localPlayerEntity?.playerController) return;
    this.localPlayerEntity.playerController.viewMode = mode;
  }

  public toggleViewMode(): PlayerViewMode {
    const nextMode: PlayerViewMode = this.getViewMode() === 'third' ? 'first' : 'third';
    this.setViewMode(nextMode);
    return nextMode;
  }

  public enableHud(
    elements: {
      debugHudRootElement: HTMLElement;
      debugHudContentElement: HTMLElement;
      gameHudElement: HTMLElement;
      scoreboardHudElement: HTMLElement;
      crosshairElement: HTMLElement;
    },
    updateHz = 10,
    debugEnabled = false,
  ): void {
    if (this.hudSystemAttached) return;
    this.hudSystemAttached = true;
    this.systems.push(
      createHudSystem(this.world, {
        updateHz,
        debugEnabled,
        debugHudRootElement: elements.debugHudRootElement,
        debugHudContentElement: elements.debugHudContentElement,
        gameHudElement: elements.gameHudElement,
        scoreboardHudElement: elements.scoreboardHudElement,
        crosshairElement: elements.crosshairElement,
        getRoomCode: () => this.getRoomCode(),
        getLastNetworkError: () => this.getLastNetworkError(),
        getViewMode: () => this.getViewMode(),
        getJumpDebugState: () => this.getJumpDebugState(),
      }),
    );
  }

  public getJumpDebugState(): {
    jumpPending: boolean;
    isGrounded: boolean;
    locomotion: string;
    movementMode: string;
    groundProbe: GroundProbeDebugState;
  } | null {
    const local = this.localPlayerEntity;
    if (!local) return null;
    return {
      jumpPending: local.playerPhysicsState.jumpPending,
      isGrounded: local.playerPhysicsState.isGrounded,
      locomotion: local.playerController?.locomotion ?? 'idle',
      movementMode: local.playerController?.movementMode ?? 'walk',
      groundProbe: this.physicsContext.lastGroundProbe as GroundProbeDebugState,
    };
  }
}
