import * as THREE from 'three';
import { World } from 'miniplex';
import {
  createTransform,
  createMesh,
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

export class Game {
  private world: World;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private systems: Array<(deltaTime: number) => void> = [];
  private lastTime: number = 0;
  private isRunning: boolean = false;

  constructor() {
    // Инициализируем Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Небесно-голубой цвет

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    // Инициализируем ECS World
    this.world = new World();

    // Получаем камеру для трёхмерной сцены
    const cameraComponent = createCamera(
      75,
      window.innerWidth / window.innerHeight
    );
    this.camera = cameraComponent.camera;
    this.camera.position.set(0, 1.6, 8);
    this.camera.lookAt(0, 1.6, -5); // Смотрим на куб!
    this.scene.add(this.camera);

    // Инициализируем системы (порядок важен!)
    this.systems.push(createInputSystem(this.world)); // Сначала обновляем ввод
    this.systems.push(createPlayerControllerSystem(this.world, this.renderer.domElement)); // Потом обрабатываем управление
    this.systems.push(createPhysicsSystem(this.world)); // Потом физика
    this.systems.push(createRenderSystem(this.world, this.scene)); // В конце рендеринг

    // Обработка изменения размера окна
    window.addEventListener('resize', () => this.onWindowResize());

    // Добавляем освещение
    this.setupLighting();
  }

  private setupLighting(): void {
    // Ambient light - более яркий
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);
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

  public createGround(): void {
    const groundGeometry = new THREE.BoxGeometry(100, 1, 100);
    
    // Создаём текстуру (шахматный паттерн для наглядности)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    const squareSize = 8;
    for (let y = 0; y < canvas.height; y += squareSize) {
      for (let x = 0; x < canvas.width; x += squareSize) {
        const isEven = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#444444' : '#666666';
        ctx.fillRect(x, y, squareSize, squareSize);
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.repeat.set(10, 10);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
    });
    const groundMesh = createMesh(groundGeometry, groundMaterial);

    const ground = this.createEntity({
      transform: createTransform([0, -1, 0]),
      mesh: groundMesh,
      rigidBody: createRigidBody(0, true), // Кинематическое тело (неподвижное)
    });

    ground.mesh.object3d.receiveShadow = true;
    ground.mesh.object3d.castShadow = true;
    this.scene.add(ground.mesh.object3d);
  }

  public createTestCube(): void {
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.7,
    });
    const cubeMesh = createMesh(cubeGeometry, cubeMaterial);

    const cube = this.createEntity({
      transform: createTransform([0, 1, -5]),
      mesh: cubeMesh,
      rigidBody: createRigidBody(0, true), // Кинематическое - не падает
    });

    cube.mesh.object3d.castShadow = true;
    cube.mesh.object3d.receiveShadow = true;
    this.scene.add(cube.mesh.object3d);
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
