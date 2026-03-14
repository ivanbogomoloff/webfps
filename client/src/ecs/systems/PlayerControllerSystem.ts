import { World } from 'miniplex';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function createPlayerControllerSystem(world: World, canvas: HTMLCanvasElement) {
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

  return (deltaTime: number) => {
    for (const entity of world.with('playerController', 'physicBody', 'input', 'camera')) {
      const controller = entity.playerController as any;
      const physicBody = entity.physicBody as CANNON.Body;
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

        // Также обновляем трансформ игрока для консистентности
        physicBody.quaternion.setFromEuler(camState.pitch, camState.yaw, 0, 'YXZ');
      }

      // Обработка движения (WASD)
      const direction = new THREE.Vector3();

      const hasW = input.keys.get('w');
      const hasS = input.keys.get('s');
      const hasA = input.keys.get('a');
      const hasD = input.keys.get('d');

      if (hasW) {
        direction.z -= 1; // Вперед - в направлении -Z (где смотрит камера)
      }
      if (hasS) {
        direction.z += 1; // Назад - в направлении +Z
      }
      if (hasA) {
        direction.x -= 1; // Влево
      }
      if (hasD) {
        direction.x += 1; // Вправо
      }

      if (direction.length() > 0) {
        direction.normalize();

        // Применяем поворот к направлению движения вокруг оси Y
        // Three.js камера смотрит в направлении -Z, поэтому инвертируем
        const cos = Math.cos(camState.yaw);
        const sin = Math.sin(camState.yaw);

        // Поворачиваем вектор направления
        const rotatedX = direction.x * cos + direction.z * sin;
        const rotatedZ = -direction.x * sin + direction.z * cos;

        // Применяем движение к позиции
        physicBody.position.x += rotatedX * controller.speed * deltaTime;
        physicBody.position.z += rotatedZ * controller.speed * deltaTime;
      }

      // Обновляем позицию камеры чтобы она следила за игроком
      camera.position.copy(physicBody.position);
      camera.position.y += 0.5; // Смещение камеры относительно позиции игрока

      // Устанавливаем камеру в положение для вида от третьего лица
      const distance = 5; // Расстояние от игрока до камеры
      const directionVector = new THREE.Vector3(0, 0, -1); // Направление смотрит вперед
      directionVector.applyEuler(new THREE.Euler(camState.pitch, camState.yaw, 0));
      directionVector.normalize();
      directionVector.multiplyScalar(distance);
      camera.position.set(
        physicBody.position.x + directionVector.x,
        physicBody.position.y + directionVector.y,
        physicBody.position.z + directionVector.z
      );

      // Устанавливаем направление камеры на игрока
      const lookAtVector = new THREE.Vector3(
        physicBody.position.x - camera.position.x,
        physicBody.position.y - camera.position.y,
        physicBody.position.z - camera.position.z
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