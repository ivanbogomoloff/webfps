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

/** Включить отрисовку границ физических тел карты (Ammo). Задаётся через VITE_DEBUG_PHYSICS=true в .env */
const DEBUG_PHYSICS = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEBUG_PHYSICS === 'true';

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
    this.systems.push(createPlayerAnimationSystem(this.world)); // Анимации персонажа
    this.matchEntity = this.createEntity({
      matchState: createMatchState(),
      scoreboard: [] as ScoreboardPlayer[],
    });
    if (this.options?.transport) {
      this.networkContext = new NetworkContext(this.options.transport);
      this.networkContext.start();
      this.systems.push(createNetworkReceiveSystem(this.world, this.scene, this.networkContext));
      this.systems.push(createRemoteInterpolationSystem(this.world));
      this.systems.push(createMatchRulesClientSystem(this.world));
      this.systems.push(createNetworkSendSystem(this.world, this.networkContext));
    }
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
    const { visualModel, idleClip, walkClip, backwardsClip, leftStClip, rightStClip } = setup;
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
    });

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
          backwards: backwardsClip,
          left_st: leftStClip,
          right_st: rightStClip,
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

  private stepPhysics(deltaTime: number): void {
    if (!this.physicsWorld || !this.ammo) return;

    // Применяем управление к телу игрока через скорость (игрок — тот же, что в PlayerControllerSystem)
    if (this.playerBody) {
      let vx = 0;
      let vz = 0;

      for (const player of this.world.with('playerController', 'object3d')) {
        const dir = (player as any).moveDirection as THREE.Vector3 | undefined;
        const speed = (player as any).playerController?.speed ?? 5;
        if (dir) {
          vx = dir.x * speed;
          vz = dir.z * speed;
        }
        break; // один игрок
      }

      const currentVel = this.playerBody.getLinearVelocity();
      const vy = currentVel.y();

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
}
