import { World } from 'miniplex';
import * as THREE from 'three';

export function createPlayerControllerSystem(
  world: World,
  canvas: HTMLCanvasElement,
) {
  const setupPointerLock = () => {
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock =
        canvas.requestPointerLock || (canvas as any).mozRequestPointerLock;
      canvas.requestPointerLock?.();
    });

    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === canvas;
      for (const entity of world.with('playerController')) {
        entity.input.mouse.isLocked = isLocked;
      }
    });
  };

  setupPointerLock();

  // Состояние камеры для отслеживания углов
  const cameraState = new Map<any, { pitch: number; yaw: number }>();

  return (_deltaTime: number) => {
    for (const entity of world.with('playerController', 'object3d', 'input', 'camera')) {
      const controller = entity.playerController as any;
      const object3d = entity.object3d as THREE.Object3D;
      const input = entity.input as any;
      const camera = entity.camera as THREE.PerspectiveCamera;

      // Инициализируем состояние камеры если его ещё нет
      if (!cameraState.has(entity)) {
        cameraState.set(entity, { pitch: 0, yaw: 0 });
      }
      const camState = cameraState.get(entity)!;

      // Обработка поворота мышью (если pointer lock активен)
      if (input.mouse.isLocked) {
        // Обновляем углы поворота
        camState.yaw -= input.mouse.deltaX * controller.sensitivity;
        camState.pitch -= input.mouse.deltaY * controller.sensitivity;

        // Ограничиваем вертикальный поворот чтобы не смотреть за спину
        camState.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camState.pitch));

        // Применяем ротацию к камере (YXZ порядок важен для FPS)
        camera.rotation.order = 'YXZ';
        camera.rotation.y = camState.yaw;
        camera.rotation.x = camState.pitch;

        // Также обновляем трансформ игрока для консистентности (YXZ)
        object3d.rotation.order = 'YXZ';
        object3d.rotation.y = camState.yaw;
        object3d.rotation.x = camState.pitch;
      }

      // Обработка движения (WASD)
      const direction = new THREE.Vector3();

      const hasW = input.keys.get('w');
      const hasS = input.keys.get('s');
      const hasA = input.keys.get('a');
      const hasD = input.keys.get('d');

      if (hasW) {
        direction.z += 1; // Вперёд
      }
      if (hasS) {
        direction.z -= 1; // Назад
      }
      if (hasA) {
        direction.x += 1; // Влево
      }
      if (hasD) {
        direction.x -= 1; // Вправо
      }

      if (direction.length() > 0) {
        direction.normalize();

        // Применяем поворот к направлению движения вокруг оси Y
        const cos = Math.cos(camState.yaw);
        const sin = Math.sin(camState.yaw);

        // Поворачиваем вектор направления
        const rotatedX = direction.x * cos + direction.z * sin;
        const rotatedZ = -direction.x * sin + direction.z * cos;

        // Сохраняем желаемое направление движения для физики
        let moveDir = entity.moveDirection as THREE.Vector3 | undefined;
        if (!moveDir) {
          moveDir = new THREE.Vector3();
          entity.moveDirection = moveDir;
        }
        moveDir.set(rotatedX, 0, rotatedZ);
      } else if (entity.moveDirection) {
        (entity.moveDirection as THREE.Vector3).set(0, 0, 0);
      }

      // Обновляем позицию камеры чтобы она следила за игроком
      camera.position.copy(object3d.position);
      camera.position.y += 0.5; // Смещение камеры относительно позиции игрока

      // Устанавливаем камеру в положение для вида от третьего лица
      const distance = 5; // Расстояние от игрока до камеры
      const directionVector = new THREE.Vector3(0, 0, -1); // Направление смотрит вперед
      directionVector.applyEuler(new THREE.Euler(camState.pitch, camState.yaw, 0));
      directionVector.normalize();
      directionVector.multiplyScalar(distance);
      camera.position.set(
        object3d.position.x + directionVector.x,
        object3d.position.y + directionVector.y,
        object3d.position.z + directionVector.z
      );

      // Устанавливаем направление камеры на игрока
      const lookAtVector = new THREE.Vector3(
        object3d.position.x - camera.position.x,
        object3d.position.y - camera.position.y,
        object3d.position.z - camera.position.z
      );
      lookAtVector.normalize();
      camera.lookAt(new THREE.Vector3(
        camera.position.x + lookAtVector.x,
        camera.position.y + lookAtVector.y,
        camera.position.z + lookAtVector.z
      ));
    }
  };
}