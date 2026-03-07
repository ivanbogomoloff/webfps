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
              node.castShadow = true;
              node.receiveShadow = true;
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
