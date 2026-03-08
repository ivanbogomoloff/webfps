import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface MapLoadResult {
  scene: THREE.Group;
  environment?: THREE.Texture;
}

export class MapLoader {
  private gltfLoader: GLTFLoader;
  private hdrLoader: RGBELoader;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.hdrLoader = new RGBELoader();
  }

  async loadMap(mapPath: string, hdrPath?: string): Promise<MapLoadResult> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        mapPath,
        async (gltf) => {
          const mapScene = gltf.scene as THREE.Group;
          
          // Включаем тени для всех объектов на карте
          mapScene.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              // TODO: с этим тоже надо будет думать, динамические тени будут только у игроков и оружия, а карта будет запекать тени в текстуры
              // node.castShadow = true;
              // node.receiveShadow = true;
            }

            if (node instanceof THREE.PointLight) {
              // TODO: на уровне сцены надо будет использовать запекание теней
              // node.castShadow = true;
              // node.shadow.bias = -0.002;
              // node.shadow.mapSize.width = 2048;
              // node.shadow.mapSize.height = 2048;
              // node.shadow.camera.near = 0.5;
              // node.shadow.camera.far = 50;
            }
          });

          console.log(`Map loaded: ${mapPath}`);

          // Пытаемся загрузить HDR, если указан путь
          let environment: THREE.Texture | undefined;
          if (hdrPath) {
            try {
              const hdrTexture = await this.loadHDR(hdrPath);
              hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
              
              environment = hdrTexture;
              console.log(`HDR environment loaded: ${hdrPath}`);
            } catch (error) {
              console.warn(`Failed to load HDR: ${hdrPath}`, error);
            }
          }

          resolve({ scene: mapScene, environment });
        },
        (progress) => {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading map: ${percentComplete.toFixed(0)}%`);
        },
        (error) => {
          console.error(`Error loading map: ${mapPath}`, error);
          reject(error);
        }
      );
    });
  }

  private loadHDR(hdrPath: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.hdrLoader.load(
        hdrPath,
        (texture) => resolve(texture),
        (progress) => {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log(`Loading HDR: ${percentComplete.toFixed(0)}%`);
        },
        (error) => reject(error)
      );
    });
  }
}
