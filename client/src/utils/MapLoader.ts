import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MapLoader {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadMap(mapPath: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        mapPath,
        (gltf) => {
          const mapScene = gltf.scene as THREE.Group;
          
          // Включаем тени для всех объектов на карте
          mapScene.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          console.log(`Map loaded: ${mapPath}`);
          resolve(mapScene);
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
}
