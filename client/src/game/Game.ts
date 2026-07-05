import * as THREE from 'three';
import Stats from 'stats.js';
import { World } from 'miniplex';

import {
  applyWeaponDefinition,
  createCamera,
  createMatchState,
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
  createWorldImpactSystem,
  createInputSystem,
  createPlayerControllerSystem,
  createPlayerAnimationSystem,
  createWeaponPoseByLocomotionSystem,
  createWeaponLoadoutSystem,
} from '../ecs/systems';
import type {
  AmmoApi,
  AmmoWorld,
  PlayerViewMode,
} from '../ecs/components';
import type { AmmoPhysicsContext, GroundProbeDebugState } from '../ecs/systems/PhysicsSystem';
import type { GameTransport } from '../net/GameTransport';
import { NetworkContext } from '../net/NetworkContext';
import type { PlayerRole, ScoreboardPlayer } from '../net/protocol';
import { MapLoader } from '../utils/MapLoader';
import { MapBuilder } from './map/MapBuilder';
import {
  createBotNavDebugSystem,
  createBotAISystem,
  ensureBotNavGraph,
  invalidateBotNavCache,
} from '../ecs/systems/bot';
import { createBotNavGraph } from '../ecs/components/bot';
import type { CollisionVolume, BoundsXZ } from './map/Map';
import { createLocalPlayerEntity, type LocalPlayerEntity } from './player/localPlayerFactory';
import { attachLocalPlayerAmmoBody } from './player/localPlayerPhysics';
import type { RespawnPoint } from './map/Map';
import type { PlayerVisualSetup } from './player/playerModelPrep';
import {
  DEFAULT_PLAYER_MODEL_ID,
  resolvePlayerModelId,
  type SupportedPlayerModelId,
} from './player/supportedPlayerModels';
import {
  DEFAULT_WEAPON_ID,
  resolveGameWeaponId,
  type SupportedWeaponId,
} from './weapon/supportedWeaponModels';

/** Включить отрисовку границ физических тел карты (Ammo). Задаётся через VITE_DEBUG_PHYSICS=true в .env */
const DEBUG_PHYSICS = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_PHYSICS === 'true';
/** Визуализация waypoints бота (сферы/рёбра). Только при VITE_DEBUG_BOT_NAV=true */
const DEBUG_BOT_NAV = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_BOT_NAV === 'true';

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
  private currentMapId: string = 'test2';
  private currentCollisionVolumes: ReadonlyArray<CollisionVolume> = [];
  private currentBoundsXZ: BoundsXZ = { minX: -50, maxX: 50, minZ: -50, maxZ: 50, area: 10000 };
  private botNavEntity: { id: number; botNavGraph: ReturnType<typeof createBotNavGraph> } | null = null;
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
    // Сетевой контекст
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
                const id = resolveGameWeaponId(weaponId);
                return weaponTemplateMap.get(id) ?? weaponTemplateMap.get(DEFAULT_WEAPON_ID);
              },
            }
          : undefined,
      );
      this.networkContext.start();
      this.systems.push(createNetworkReceiveSystem(this.world, this.scene, this.networkContext));
      this.systems.push(createRemoteInterpolationSystem(this.world));
      this.systems.push(
        createBotAISystem(this.world, {
          physicsContext: this.physicsContext,
          getAllPlayerStates: () => this.getAllPlayerStates(),
        }),
      );
      this.systems.push(createBotNavDebugSystem(this.world, this.scene, DEBUG_BOT_NAV));
      this.systems.push(createMatchRulesClientSystem(this.world));
      this.systems.push(createShotSendSystem(this.world, this.networkContext));
      this.systems.push(
        createWorldImpactSystem(this.world, {
          scene: this.scene,
          physicsContext: this.physicsContext,
        }),
      );
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
          const resolvedId = resolveGameWeaponId(weaponId);
          return map.get(resolvedId) ?? map.get(DEFAULT_WEAPON_ID);
        },
      }),
    );
    // После сетевого приёма: у соперников `playerController.locomotion` уже из пакета.
    this.systems.push(createPlayerAnimationSystem(this.world));
    this.systems.push(createWeaponPoseByLocomotionSystem(this.world));
    this.systems.push(createPhysicsSystem(this.world, this.physicsContext));
    this.systems.push(createAudioSystem(this.world, this.camera));
    this.systems.push(
      createRenderSystem(this.world, {
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
      }),
    ); // В конце рендеринг

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
    this.physicsContext.defaultGravity.set(0, -9.8, 0);
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
    const entity = createLocalPlayerEntity({
      world: this.world,
      camera: this.camera,
      setup,
      localNickname: this.options?.localNickname,
      localModelId: this.options?.localModelId,
      localWeaponId: this.options?.localWeaponId,
      createEntity: (components) => this.createEntity(components),
    });

    this.physicsContext.playerRadius = playerRadius;
    this.localPlayerEntity = entity;
    this.networkContext?.setLocalPlayerEntity(entity);
    attachLocalPlayerAmmoBody({
      world: this.world,
      entity,
      playerRadius,
      physicsReady: this.physicsReady,
      getAmmo: () => this.ammo,
      getPhysicsWorld: () => this.physicsWorld,
    });
  }

  public async loadMap(mapPath: string, hdrPath?: string, mapId?: string): Promise<void> {
    try {
      console.log(`Loading map: ${mapPath}`);
      if (mapId) {
        this.currentMapId = mapId;
      }

      if (this.currentMap) {
        this.scene.remove(this.currentMap);
      }
      this.currentRespawns = [];
      this.currentCollisionVolumes = [];
      this.physicsContext.ladders = [];
      this.botNavEntity = null;
      invalidateBotNavCache();
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
      this.currentCollisionVolumes = map.getCollisionVolumes();
      this.currentBoundsXZ = map.getBoundsXZ();
      this.physicsContext.ladders = map.getLadders();
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

      void this.ensureBotNav().catch((error) => {
        console.warn('[Game] Bot nav build failed during map load:', error);
      });

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

  public async ensureBotNav(): Promise<void> {
    await ensureBotNavGraph({
      mapId: this.currentMapId,
      collisionVolumes: this.currentCollisionVolumes,
      boundsXZ: this.currentBoundsXZ,
      physicsContext: this.physicsContext,
      getNavEntity: () => this.botNavEntity,
      setNavEntity: (entity) => {
        if (!this.botNavEntity) {
          this.botNavEntity = this.createEntity(entity);
        } else {
          this.botNavEntity.botNavGraph = entity.botNavGraph;
        }
      },
      networkContext: this.networkContext,
    });
  }

  public addBot(): void {
    const local = this.localPlayerEntity;
    const pos = local?.object3d?.position;
    const spawnHint =
      pos && pos.y > 0.5
        ? {
            spawnX: pos.x,
            spawnY: pos.y,
            spawnZ: pos.z,
            spawnRotY: local.object3d?.rotation.y ?? 0,
          }
        : undefined;
    if (!spawnHint) {
      console.warn('[Game] Add Bot: local position not on map yet — press Enter Match first');
    }
    this.networkContext?.addBot(spawnHint);
    void this.ensureBotNav().catch((error) => {
      console.warn('[Game] Bot nav build failed (bot still requested):', error);
    });
  }

  public canAddBot(): boolean {
    return this.networkContext?.canAddBot() ?? false;
  }

  public isNetworkConnected(): boolean {
    return this.options?.transport?.isConnected() ?? false;
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

  public getLocalPlayerPosition(): { x: number; y: number; z: number } | null {
    const pos = this.localPlayerEntity?.object3d?.position;
    if (!pos) return null;
    return { x: pos.x, y: pos.y, z: pos.z };
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
      reloadHudElement: HTMLElement;
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
        reloadHudElement: elements.reloadHudElement,
        getRoomCode: () => this.getRoomCode(),
        getLastNetworkError: () => this.getLastNetworkError(),
        getJumpDebugState: () => this.getJumpDebugState(),
        getBotDebugState: () => this.getBotDebugState(),
      }),
    );
  }

  private getAllPlayerStates(): Array<{
    playerId: string;
    x: number;
    y: number;
    z: number;
    isDead: boolean;
  }> {
    const out: Array<{ playerId: string; x: number; y: number; z: number; isDead: boolean }> = [];
    const local = this.localPlayerEntity;
    if (local?.networkIdentity && local.object3d) {
      out.push({
        playerId: local.networkIdentity.playerId,
        x: local.object3d.position.x,
        y: local.object3d.position.y,
        z: local.object3d.position.z,
        isDead: local.health?.isDead ?? false,
      });
    }
    if (!this.networkContext) return out;
    for (const entity of this.world.with('networkIdentity', 'networkTransform')) {
      const e = entity as any;
      if (e.networkIdentity?.isLocal) continue;
      out.push({
        playerId: e.networkIdentity.playerId,
        x: e.networkTransform.x,
        y: e.networkTransform.y,
        z: e.networkTransform.z,
        isDead: e.health?.isDead ?? false,
      });
    }
    return out;
  }

  public getBotDebugState(): {
    mapId: string;
    waypointCount: number;
    edgeCount: number;
    serverWaypointCount: number;
    botId: string | null;
    waypointIndex: number;
    targetId: string | null;
    predDelta: number | null;
  } | null {
    const nav = this.botNavEntity?.botNavGraph;
    if (!nav) return null;

    let botEntity: any = null;
    for (const entity of this.world.with('botIdentity', 'botAgentState')) {
      botEntity = entity;
      break;
    }

    return {
      mapId: nav.mapId,
      waypointCount: nav.waypoints.length,
      edgeCount: nav.edges.length,
      serverWaypointCount: this.networkContext?.getServerBotNavWaypointCount() ?? 0,
      botId: botEntity?.botIdentity?.playerId ?? null,
      waypointIndex: botEntity?.botAgentState?.waypointIndex ?? 0,
      targetId: botEntity?.botAgentState?.targetId ?? null,
      predDelta: botEntity?.botDebugDelta ?? null,
    };
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
