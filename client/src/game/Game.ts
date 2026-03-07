import * as THREE from 'three';
import { World } from 'miniplex';
import {
  createTransform,
  createRigidBody,
  createCamera,
  createInput,
  createHealth,
  createPlayerController,
} from '../ecs/components';
import {
  createRenderSystem,
  createPhysicsSystem,
  createInputSystem,
  createPlayerControllerSystem,
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

  constructor() {
    // Инициализируем Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Небесно-голубой цвет

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    //this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    document.body.appendChild(this.renderer.domElement);

    // Инициализируем MapLoader
    this.mapLoader = new MapLoader();

    // Инициализируем ECS World
    this.world = new World();

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
    this.systems.push(createPlayerControllerSystem(this.world, this.renderer.domElement)); // Потом обрабатываем управление
    this.systems.push(createPhysicsSystem(this.world)); // Потом физика
    this.systems.push(createRenderSystem(this.world, this.scene)); // В конце рендеринг

    // Обработка изменения размера окна
    window.addEventListener('resize', () => this.onWindowResize());
  }

  public createEntity(components: Record<string, any>) {
    const entity: any = { id: Math.random() };
    Object.assign(entity, components);
    this.world.add(entity);
    return entity;
  }

  public createPlayer(): void {
    const player = this.createEntity({
      transform: createTransform([0, 1, 0]),
      input: createInput(),
      camera: this.camera,
      health: createHealth(100),
      rigidBody: createRigidBody(1, true), // Кинематическое - управляем вручную
      playerController: createPlayerController(5, 0.003), // 5 м/с скорость, чувствительность мыши
    });

    // Устанавливаем начальную позицию камеры
    this.camera.position.copy(player.transform.position);
    this.camera.position.y += 0.5;
  }

  public async loadMap(mapPath: string, hdrPath?: string): Promise<void> {
    try {
      console.log(`Loading map: ${mapPath}`);
      const { scene: mapScene, environment } = await this.mapLoader.loadMap(mapPath, hdrPath);
      
      // Удаляем старую карту если она была
      if (this.currentMap) {
        this.scene.remove(this.currentMap);
      }
      
      // Добавляем новую карту в сцену
      this.currentMap = mapScene;
      this.scene.add(mapScene);
      
      // Устанавливаем окружение (HDR) если оно загружено
      if (environment) {
        //this.scene.environment = environment;
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
  };

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
