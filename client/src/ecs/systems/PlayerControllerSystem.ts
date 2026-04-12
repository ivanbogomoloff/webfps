import { World } from 'miniplex';
import * as THREE from 'three';
import { locomotionFromStrafeAxes, toCrouchLocomotion, toFireLocomotion, toRunLocomotion } from '../../game/playerLocomotionLogic';
import type { Health, Input, NetworkIdentity, PlayerController, PlayerPhysicsState } from '../components';

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
        const ni = (entity as { networkIdentity?: NetworkIdentity }).networkIdentity;
        if (ni && !ni.isLocal) {
          continue;
        }
        entity.input.mouse.isLocked = isLocked;
      }
    });
  };

  setupPointerLock();

  // Состояние камеры для отслеживания углов
  const cameraState = new Map<object, { pitch: number; yaw: number }>();
  const prevSpaceDown = new Map<object, boolean>();

  return (_deltaTime: number) => {
    for (const entity of world.with('playerController', 'playerPhysicsState', 'object3d', 'input', 'camera')) {
      const networkIdentity = (entity as { networkIdentity?: NetworkIdentity }).networkIdentity;
      if (networkIdentity && !networkIdentity.isLocal) {
        continue;
      }

      const controller = entity.playerController as PlayerController;
      const physicsState = entity.playerPhysicsState as PlayerPhysicsState;
      const object3d = entity.object3d as THREE.Object3D;
      const input = entity.input as Input;
      const camera = entity.camera as THREE.PerspectiveCamera;
      const health = (entity as { health?: Health }).health;

      // Инициализируем состояние камеры если его ещё нет
      if (!cameraState.has(entity)) {
        cameraState.set(entity, { pitch: 0, yaw: 0 });
      }
      const camState = cameraState.get(entity)!;

      if (health?.isDead) {
        physicsState.moveDirection.set(0, 0, 0);
        physicsState.jumpPending = false;
        controller.locomotion = health.forcedLocomotion ?? 'death_back';
        continue;
      }

      // Обработка поворота мышью (если pointer lock активен)
      if (input.mouse.isLocked) {
        // Обновляем углы поворота
        camState.yaw -= input.mouse.deltaX * controller.sensitivity;
        camState.pitch -= input.mouse.deltaY * controller.sensitivity;

        // Ограничиваем вертикальный поворот чтобы не смотреть за спину
        camState.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camState.pitch));

        // Камера: yaw/pitch для состояния (ниже позиция и lookAt задают фактический вид)
        camera.rotation.order = 'YXZ';
        camera.rotation.y = camState.yaw;
        camera.rotation.x = camState.pitch;
      }

      // Модель игрока всегда вертикальна: только yaw (как в TPS), без наклона от pitch мыши
      object3d.rotation.set(0, camState.yaw, 0, 'YXZ');

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

      if (networkIdentity?.role === 'spectator') {
        direction.set(0, 0, 0);
      }

      const fz = (hasW ? 1 : 0) + (hasS ? -1 : 0);
      const fx = (hasA ? 1 : 0) + (hasD ? -1 : 0);
      const baseLocomotion = locomotionFromStrafeAxes(fz, fx);
      const crouchDown = !!input.keys.get('control') || !!input.keys.get('ctrl');
      const runDown = !!input.keys.get('shift');
      if (crouchDown) {
        controller.movementMode = 'crouch';
      } else if (runDown) {
        controller.movementMode = 'run';
      } else {
        controller.movementMode = 'walk';
      }
      const modeLocomotion =
        controller.movementMode === 'crouch'
          ? toCrouchLocomotion(baseLocomotion)
          : controller.movementMode === 'run'
            ? toRunLocomotion(baseLocomotion)
            : baseLocomotion;

      const spaceDown =
        !!input.keys.get(' ') ||
        !!input.keys.get('space');
      const wasSpace = prevSpaceDown.get(entity) ?? false;
      if (networkIdentity?.role === 'player' && spaceDown && !wasSpace) {
        physicsState.jumpPending = true;
      }
      prevSpaceDown.set(entity, spaceDown);

      const isGrounded = physicsState.isGrounded;
      const jumpPending = physicsState.jumpPending;
      if (!isGrounded || jumpPending) {
        controller.locomotion = 'jump_up';
      } else {
        const wantsFire = input.mouse.primaryDown;
        const fireLocomotion = wantsFire ? toFireLocomotion(modeLocomotion) : null;
        controller.locomotion = fireLocomotion ?? modeLocomotion;
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
        physicsState.moveDirection.set(rotatedX, 0, rotatedZ);
      } else {
        physicsState.moveDirection.set(0, 0, 0);
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