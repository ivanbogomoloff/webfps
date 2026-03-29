import * as THREE from 'three';
import Stats from 'stats.js';
import { World } from 'miniplex';

import {
  createCamera,
  createInput,
  createHealth,
  createMatchState,
  createNetworkIdentity,
  createNetworkTransform,
  createPlayerController,
  createPlayerAnimation,
  createPlayerStats,
} from '../ecs/components';
import {
  createMatchRulesClientSystem,
  createNetworkReceiveSystem,
  createNetworkSendSystem,
  createRenderSystem,
  createRemoteInterpolationSystem,
  createInputSystem,
  createPlayerControllerSystem,
  createPlayerAnimationSystem,
} from '../ecs/systems';
import type { GameTransport } from '../net/GameTransport';
import { NetworkContext } from '../net/NetworkContext';
import type { PlayerRole, ScoreboardPlayer } from '../net/protocol';
import { MapLoader } from '../utils/MapLoader';
import { MapBuilder } from './MapBuilder';
import type { PlayerVisualSetup } from './playerModelPrep';
import {
  DEFAULT_PLAYER_MODEL_ID,
  resolvePlayerModelId,
  type SupportedPlayerModelId,
} from './supportedPlayerModels';

/** Включить отрисовку границ физических тел карты (Ammo). Задаётся через VITE_DEBUG_PHYSICS=true в .env */
const DEBUG_PHYSICS = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_PHYSICS === 'true';

/** Вертикальная скорость при прыжке (динамическое тело-сфера). */
const PLAYER_JUMP_SPEED = 3.8;
/** Луч вниз от нижней полусферы: длина и зазор от поверхности сферы. */
const GROUND_RAY_MARGIN = 0.05;
const GROUND_RAY_LENGTH = 0.38;

type GroundProbeDebugState = {
  x: number;
  y: number;
  z: number;
  fromY: number;
  toY: number;
  hit: boolean;
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
  /** Группа с wireframe-боксами границ физических тел карты (только при VITE_DEBUG_PHYSICS=true) */
  private physicsDebugRoot: THREE.Group | null = null;
  private statsJs: Stats;
  private ammo: any | null = null;
  private physicsWorld: any | null = null;
  private ammoCollisionConfig: any;
  private ammoDispatcher: any;
  private ammoBroadphase: any;
  private ammoSolver: any;
  private ammoTransform: any;
  private physicsReady: Promise<void>;
  private playerRadius = 0.5;
  private groundRayCallback: any | null = null;
  private groundRayFrom: any | null = null;
  private groundRayTo: any | null = null;
  private lastGroundProbe: GroundProbeDebugState = {
    x: 0,
    y: 0,
    z: 0,
    fromY: 0,
    toY: 0,
    hit: false,
  };
  private playerBody: any | null = null;
  private playerObject3D: THREE.Object3D | null = null;
  private localPlayerEntity: any | null = null;
  private matchEntity: any | null = null;
  private networkContext: NetworkContext | null = null;

  constructor(
    private readonly options?: {
      transport?: GameTransport;
      localNickname?: string;
      localModelId?: string;
      /** Шаблоны GLB по `SupportedPlayerModelId` — для визуала удалённых игроков. */
      playerModelTemplates?: Map<SupportedPlayerModelId, PlayerVisualSetup>;
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
    this.matchEntity = this.createEntity({
      matchState: createMatchState(),
      scoreboard: [] as ScoreboardPlayer[],
    });
    if (this.options?.transport) {
      const templateMap = this.options.playerModelTemplates;
      this.networkContext = new NetworkContext(
        this.options.transport,
        templateMap?.size
          ? {
              getPlayerVisualTemplate: (modelId: string) => {
                const id = resolvePlayerModelId(modelId);
                return templateMap.get(id) ?? templateMap.get(DEFAULT_PLAYER_MODEL_ID);
              },
            }
          : undefined,
      );
      this.networkContext.start();
      this.systems.push(createNetworkReceiveSystem(this.world, this.scene, this.networkContext));
      this.systems.push(createRemoteInterpolationSystem(this.world));
      this.systems.push(createMatchRulesClientSystem(this.world));
      this.systems.push(createNetworkSendSystem(this.world, this.networkContext));
    }
    // После сетевого приёма: у соперников `playerController.locomotion` уже из пакета.
    this.systems.push(createPlayerAnimationSystem(this.world));
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
    this.ammo = await AmmoGlobal.Ammo();

    this.ammoCollisionConfig = new this.ammo.btDefaultCollisionConfiguration();
    this.ammoDispatcher = new this.ammo.btCollisionDispatcher(this.ammoCollisionConfig);
    this.ammoBroadphase = new this.ammo.btDbvtBroadphase();
    this.ammoSolver = new this.ammo.btSequentialImpulseConstraintSolver();
    this.physicsWorld = new this.ammo.btDiscreteDynamicsWorld(
      this.ammoDispatcher,
      this.ammoBroadphase,
      this.ammoSolver,
      this.ammoCollisionConfig
    );
    this.physicsWorld.setGravity(new this.ammo.btVector3(0, -9.8, 0));

    this.ammoTransform = new this.ammo.btTransform();

    this.groundRayFrom = new this.ammo.btVector3(0, 0, 0);
    this.groundRayTo = new this.ammo.btVector3(0, -1, 0);
    this.groundRayCallback = new this.ammo.ClosestRayResultCallback(
      this.groundRayFrom,
      this.groundRayTo,
    );
  }

  public createEntity(components: Record<string, any>) {
    const entity: any = { id: Math.random() };
    Object.assign(entity, components);
    this.world.add(entity);

    if(entity.object3d) {
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
      jumpUpClip,
    } = setup;
    const playerRoot = new THREE.Group();
    playerRoot.position.set(0, 6, 0);
    playerRoot.add(visualModel);

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
        true,
        'spectator'
      ),
      playerStats: createPlayerStats(),
      playerController: createPlayerController(5, 0.003), // 5 м/с скорость, чувствительность мыши
      moveDirection: new THREE.Vector3(0, 0, 0), // задаётся PlayerControllerSystem, читается в stepPhysics
      isGrounded: true,
      jumpPending: false,
    });

    this.playerRadius = playerRadius;
    this.localPlayerEntity = entity;
    this.networkContext?.setLocalPlayerEntity(entity);
    this.playerObject3D = playerRoot;

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
          jump_up: jumpUpClip,
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
      this.playerBody = body;
      (entity as any).physicBody = body;
    })();
  }

  public async loadMap(mapPath: string, hdrPath?: string): Promise<void> {
    try {
      console.log(`Loading map: ${mapPath}`);

      if (this.currentMap) {
        this.scene.remove(this.currentMap);
      }
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
      this.scene.add(map.scene);
      if (physicsDebugRoot) {
        this.physicsDebugRoot = physicsDebugRoot;
        if (DEBUG_PHYSICS) {
          console.log('[DEBUG] Physics bounds visible (VITE_DEBUG_PHYSICS=true)');
        }
      }

      // Позиционируем игрока на одной из точек респауна
      const respawns = map.getRespawns();
      const playerRadius = 0.5;
      if (respawns.length > 0 && this.playerBody && this.playerObject3D) {
        const point = respawns[Math.floor(Math.random() * respawns.length)];
        const spawnY = point.center.y + point.size.y / 2 + playerRadius;
        const spawnX = point.center.x;
        const spawnZ = point.center.z;
        this.playerObject3D.position.set(spawnX, spawnY, spawnZ);
        const originVec = new this.ammo!.btVector3(spawnX, spawnY, spawnZ);
        this.ammoTransform.setIdentity();
        this.ammoTransform.setOrigin(originVec);
        this.playerBody.setWorldTransform(this.ammoTransform);
        this.ammo!.destroy(originVec);
      }

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

    // Обновляем физику Ammo и синхронизируем игрока
    this.stepPhysics(deltaTime);

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

  private probeGrounded(worldX: number, worldY: number, worldZ: number): boolean {
    if (!this.physicsWorld || !this.ammo || !this.groundRayCallback || !this.groundRayFrom || !this.groundRayTo) {
      return false;
    }
    const r = this.playerRadius;
    // Стартуем немного ВЫШЕ нижней точки сферы и лучом идём вниз через уровень пола.
    // Иначе (при старте ниже) rayTest часто не видит поверхность под игроком.
    const y0 = worldY - r + GROUND_RAY_MARGIN;
    const y1 = y0 - (GROUND_RAY_MARGIN + GROUND_RAY_LENGTH);
    this.lastGroundProbe.x = worldX;
    this.lastGroundProbe.y = worldY;
    this.lastGroundProbe.z = worldZ;
    this.lastGroundProbe.fromY = y0;
    this.lastGroundProbe.toY = y1;
    this.groundRayFrom.setValue(worldX, y0, worldZ);
    this.groundRayTo.setValue(worldX, y1, worldZ);
    this.groundRayCallback.set_m_closestHitFraction(1);
    this.groundRayCallback.set_m_rayFromWorld(this.groundRayFrom);
    this.groundRayCallback.set_m_rayToWorld(this.groundRayTo);
    this.physicsWorld.rayTest(this.groundRayFrom, this.groundRayTo, this.groundRayCallback);
    const hit = this.groundRayCallback.hasHit();
    this.lastGroundProbe.hit = hit;
    return hit;
  }

  /** Надёжная проверка опоры: есть ли контакт тела игрока с поверхностью под ним. */
  private isBodyGroundedByContacts(): boolean {
    if (!this.physicsWorld || !this.playerBody) return false;
    const dispatcher = this.physicsWorld.getDispatcher?.();
    if (!dispatcher) return false;

    const playerPtr = (this.playerBody as { hy?: number }).hy;
    if (playerPtr == null) return false;

    const manifolds = dispatcher.getNumManifolds?.() ?? 0;
    for (let i = 0; i < manifolds; i += 1) {
      const manifold = dispatcher.getManifoldByIndexInternal?.(i);
      if (!manifold) continue;
      const body0 = manifold.getBody0?.();
      const body1 = manifold.getBody1?.();
      const isBody0Player = !!body0 && (body0 as { hy?: number }).hy === playerPtr;
      const isBody1Player = !!body1 && (body1 as { hy?: number }).hy === playerPtr;
      if (!isBody0Player && !isBody1Player) continue;

      const contacts = manifold.getNumContacts?.() ?? 0;
      for (let j = 0; j < contacts; j += 1) {
        const point = manifold.getContactPoint?.(j);
        if (!point) continue;
        // <= 0 означает реальный контакт/перекрытие.
        if ((point.getDistance?.() ?? 1) > 0.02) continue;
        const normal = point.get_m_normalWorldOnB?.();
        if (!normal) continue;
        const ny = normal.y?.() ?? 0;
        // normalWorldOnB направлена от B к A; разворачиваем к направлению "вверх от опоры к игроку".
        const supportUp = isBody0Player ? ny : -ny;
        if (supportUp > 0.45) {
          return true;
        }
      }
    }
    return false;
  }

  private stepPhysics(deltaTime: number): void {
    if (!this.physicsWorld || !this.ammo) return;

    // Только локальный игрок имеет физическое тело; у удалённых тоже есть playerController (анимация),
    // поэтому нельзя брать «первого» из with('playerController') — иначе при 2+ игроках скорость читается не с того.
    if (this.playerBody) {
      let vx = 0;
      let vz = 0;

      const local = this.localPlayerEntity as
        | {
            moveDirection?: THREE.Vector3;
            playerController?: { speed?: number };
            jumpPending?: boolean;
            isGrounded?: boolean;
          }
        | null;

      const motionState = this.playerBody.getMotionState();
      let px = 0;
      let py = 0;
      let pz = 0;
      if (motionState) {
        motionState.getWorldTransform(this.ammoTransform);
        const origin = this.ammoTransform.getOrigin();
        px = origin.x();
        py = origin.y();
        pz = origin.z();
      }

      this.probeGrounded(px, py, pz);
      const groundedForJump = this.isBodyGroundedByContacts();

      if (local?.moveDirection && local.playerController) {
        const dir = local.moveDirection;
        const speed = local.playerController.speed ?? 5;
        vx = dir.x * speed;
        vz = dir.z * speed;
      }

      const currentVel = this.playerBody.getLinearVelocity();
      let vy = currentVel.y();

      if (local?.jumpPending && groundedForJump) {
        vy = PLAYER_JUMP_SPEED;
      }
      if (local) {
        local.jumpPending = false;
      }

      // Будим тело, если оно уснуло, чтобы скорость применилась
      this.playerBody.activate(true);

      const newVel = new this.ammo.btVector3(vx, vy, vz);
      this.playerBody.setLinearVelocity(newVel);
      this.ammo.destroy(newVel);
    }

    this.physicsWorld.stepSimulation(deltaTime, 10);

    // Синхронизируем только позицию меша игрока с телом Ammo; поворот задаёт PlayerControllerSystem (камера)
    if (this.playerBody && this.playerObject3D) {
      const motionState = this.playerBody.getMotionState();
      if (motionState) {
        motionState.getWorldTransform(this.ammoTransform);
        const origin = this.ammoTransform.getOrigin();

        this.playerObject3D.position.set(
          origin.x(),
          origin.y(),
          origin.z()
        );

        const le = this.localPlayerEntity as { isGrounded?: boolean } | null;
        if (le) {
          this.probeGrounded(origin.x(), origin.y(), origin.z());
          le.isGrounded = this.isBodyGroundedByContacts();
        }
      }
    }
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

  public reportKill(victimPlayerId: string): void {
    this.networkContext?.reportKill(victimPlayerId);
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

  public getJumpDebugState(): {
    jumpPending: boolean;
    isGrounded: boolean;
    locomotion: string;
    groundProbe: GroundProbeDebugState;
  } | null {
    const local = this.localPlayerEntity as
      | { jumpPending?: boolean; isGrounded?: boolean; playerController?: { locomotion?: string } }
      | null;
    if (!local) return null;
    return {
      jumpPending: !!local.jumpPending,
      isGrounded: local.isGrounded !== false,
      locomotion: local.playerController?.locomotion ?? 'idle',
      groundProbe: this.lastGroundProbe,
    };
  }
}
