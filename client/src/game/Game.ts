import * as THREE from 'three';
import Stats from 'stats.js';
import { World } from 'miniplex';

import {
  createCamera,
  createInput,
  createHealth,
  createPlayerController,
} from '../ecs/components';
import {
  createRenderSystem,
  createInputSystem,
  createPlayerControllerSystem
} from '../ecs/systems';
import { MapLoader } from '../utils/MapLoader';

export class Game {
  private world: World;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private systems: Array<(deltaTime: number) => void> = [];
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private mapLoader: MapLoader;
  private currentMap: THREE.Group | null = null;
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

  constructor() {
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

    // Инициализируем MapLoader
    this.mapLoader = new MapLoader();

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

  public createPlayer(): void {
    const playerRadius = 0.5;
    const playerObject3D = new THREE.Mesh(
        new THREE.SphereGeometry(playerRadius, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );

    playerObject3D.position.set(0, 6, 0);

    const entity = this.createEntity({
      input: createInput(),
      camera: this.camera,
      object3d: playerObject3D,
      health: createHealth(100),
      playerController: createPlayerController(5, 0.003), // 5 м/с скорость, чувствительность мыши
      moveDirection: new THREE.Vector3(0, 0, 0), // задаётся PlayerControllerSystem, читается в stepPhysics
    });

    this.playerObject3D = playerObject3D;

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
      const { scene: mapScene, environment } = await this.mapLoader.loadMap(mapPath, hdrPath);
      
      // Удаляем старую карту если она была
      if (this.currentMap) {
        this.scene.remove(this.currentMap);
      }

      // Добавляем все меши карты в Ammo как статические box-тела
      await this.physicsReady;
      if (this.ammo && this.physicsWorld) {
        const box = new THREE.Box3();
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        mapScene.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if ((mesh as any).isMesh) {
            box.setFromObject(mesh);
            box.getSize(size);
            box.getCenter(center);

            const halfExtents = new this.ammo.btVector3(
              size.x / 2,
              size.y / 2,
              size.z / 2
            );
            const shape = new this.ammo.btBoxShape(halfExtents);

            const transform = new this.ammo.btTransform();
            transform.setIdentity();
            transform.setOrigin(
              new this.ammo.btVector3(center.x, center.y, center.z)
            );

            const motionState = new this.ammo.btDefaultMotionState(transform);
            const mass = 0;
            const localInertia = new this.ammo.btVector3(0, 0, 0);

            const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
              mass,
              motionState,
              shape,
              localInertia
            );
            const body = new this.ammo.btRigidBody(rbInfo);

            this.physicsWorld.addRigidBody(body);
          }
        });
      }

      // Добавляем новую карту в сцену
      this.currentMap = mapScene;
      this.scene.add(mapScene);
      
      // Устанавливаем окружение (HDR) если оно загружено
      if (environment) {
        this.scene.environment = environment;
        this.scene.background = environment; // Опционально: используем HDR как фон
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

      const newVel = new this.ammo.btVector3(vx, vy, vz);
      this.playerBody.setLinearVelocity(newVel);
      this.ammo.destroy(newVel);
    }

    this.physicsWorld.stepSimulation(deltaTime, 10);

    // Синхронизируем позицию и поворот меша игрока с телом Ammo
    if (this.playerBody && this.playerObject3D) {
      const motionState = this.playerBody.getMotionState();
      if (motionState) {
        motionState.getWorldTransform(this.ammoTransform);
        const origin = this.ammoTransform.getOrigin();
        const rotation = this.ammoTransform.getRotation();

        this.playerObject3D.position.set(
          origin.x(),
          origin.y(),
          origin.z()
        );
        this.playerObject3D.quaternion.set(
          rotation.x(),
          rotation.y(),
          rotation.z(),
          rotation.w()
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
  }

  public getWorld(): World {
    return this.world;
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
}
