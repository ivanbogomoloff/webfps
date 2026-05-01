import { World } from 'miniplex';
import * as THREE from 'three';
import { locomotionFromStrafeAxes, toCrouchLocomotion, toFireLocomotion, toRunLocomotion } from '../../game/player/playerLocomotionLogic';
import { getWeaponDefinition } from '../../game/weapon/supportedWeaponModels';
import type { Health, Input, NetworkIdentity, PlayerController, PlayerPhysicsState, WeaponState } from '../components';

export function createPlayerControllerSystem(
  world: World,
  canvas: HTMLCanvasElement,
) {
  const FIRST_PERSON_EYE_Y = 1.0;
  const FIRST_PERSON_CROUCH_EYE_Y = 0.35;
  const THIRD_PERSON_DISTANCE = 5;
  const DEAD_CAMERA_PITCH = Math.PI / 4;
  const thirdPersonDirection = new THREE.Vector3();
  const thirdPersonLookAt = new THREE.Vector3();
  const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

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
  const prevReloadDown = new Map<object, boolean>();

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
      const weaponState = (entity as { weaponState?: WeaponState }).weaponState;

      // Инициализируем состояние камеры если его ещё нет
      if (!cameraState.has(entity)) {
        cameraState.set(entity, { pitch: 0, yaw: 0 });
      }
      const camState = cameraState.get(entity)!;

      if (health?.isDead) {
        physicsState.moveDirection.set(0, 0, 0);
        physicsState.jumpPending = false;
        controller.locomotion = health.forcedLocomotion ?? 'death_back';
        if (weaponState) {
          weaponState.action = 'hide';
          weaponState.actionHoldSec = 0;
          weaponState.isReloading = false;
          weaponState.reloadRemainingSec = 0;
        }
        // Death camera is fixed: top-down at 45 degrees, independent from mouse look.
        const deadYaw = object3d.rotation.y;
        thirdPersonDirection.set(0, 0, -1);
        cameraEuler.set(DEAD_CAMERA_PITCH, deadYaw, 0, 'YXZ');
        thirdPersonDirection.applyEuler(cameraEuler).normalize();
        thirdPersonDirection.multiplyScalar(THIRD_PERSON_DISTANCE);
        camera.position.set(
          object3d.position.x + thirdPersonDirection.x,
          object3d.position.y + thirdPersonDirection.y,
          object3d.position.z + thirdPersonDirection.z,
        );
        thirdPersonLookAt.copy(object3d.position);
        camera.lookAt(thirdPersonLookAt);
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

      // Movement mapping was tuned for third-person chase camera (camera looks toward player).
      // In first-person we need the same WASD semantics as player expects in view direction.
      if (controller.viewMode === 'first') {
        direction.multiplyScalar(-1);
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
      const reloadDown = !!input.keys.get('r');
      const wasReloadDown = prevReloadDown.get(entity) ?? false;
      if (weaponState) {
        const weaponDef = getWeaponDefinition(weaponState.weaponId);
        if (weaponState.isPicking) {
          weaponState.pickRemainingSec = Math.max(0, weaponState.pickRemainingSec - _deltaTime);
          if (weaponState.pickRemainingSec <= 0) {
            weaponState.isPicking = false;
            weaponState.pickRemainingSec = 0;
          }
        }
        const canStartReload =
          networkIdentity?.role === 'player' &&
          controller.viewMode === 'first' &&
          !weaponState.isPicking &&
          !weaponState.isReloading &&
          weaponState.ammoInMag < weaponState.magazineSize;
        if (reloadDown && !wasReloadDown && canStartReload) {
          weaponState.isReloading = true;
          weaponState.reloadRemainingSec = weaponDef.reloadTimeSec;
          weaponState.action = 'reload';
          weaponState.actionHoldSec = weaponDef.reloadTimeSec;
        }
        if (weaponState.isReloading) {
          weaponState.reloadRemainingSec = Math.max(0, weaponState.reloadRemainingSec - _deltaTime);
          if (weaponState.reloadRemainingSec <= 0) {
            weaponState.isReloading = false;
            weaponState.reloadRemainingSec = 0;
            weaponState.ammoInMag = weaponState.magazineSize;
            weaponState.actionHoldSec = 0;
          }
        }
        weaponState.actionHoldSec = Math.max(0, weaponState.actionHoldSec - _deltaTime);
      }
      prevReloadDown.set(entity, reloadDown);

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
        const canUseFireLocomotion = !weaponState || (!weaponState.isPicking && !weaponState.isReloading && weaponState.ammoInMag > 0);
        const wantsFire = input.mouse.primaryDown && canUseFireLocomotion;
        const fireLocomotion = wantsFire ? toFireLocomotion(modeLocomotion) : null;
        controller.locomotion = fireLocomotion ?? modeLocomotion;
      }
      if (weaponState) {
        if (controller.viewMode !== 'first') {
          weaponState.action = 'hide';
        } else if (weaponState.isPicking) {
          weaponState.action = 'pick';
        } else if (weaponState.isReloading) {
          weaponState.action = 'reload';
        } else if (weaponState.actionHoldSec <= 0) {
          weaponState.action = controller.movementMode === 'run' ? 'run' : 'walk';
        }
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

      if (controller.viewMode === 'first') {
        const eyeY =
          controller.movementMode === 'crouch'
            ? FIRST_PERSON_CROUCH_EYE_Y
            : FIRST_PERSON_EYE_Y;
        camera.position.copy(object3d.position);
        camera.position.y += eyeY;
        camera.rotation.order = 'YXZ';
        camera.rotation.y = camState.yaw;
        camera.rotation.x = camState.pitch;
      } else {
        // Third-person camera orbit.
        thirdPersonDirection.set(0, 0, -1);
        cameraEuler.set(camState.pitch, camState.yaw, 0, 'YXZ');
        thirdPersonDirection.applyEuler(cameraEuler).normalize();
        thirdPersonDirection.multiplyScalar(THIRD_PERSON_DISTANCE);
        camera.position.set(
          object3d.position.x + thirdPersonDirection.x,
          object3d.position.y + thirdPersonDirection.y,
          object3d.position.z + thirdPersonDirection.z,
        );
        thirdPersonLookAt.copy(object3d.position);
        camera.lookAt(thirdPersonLookAt);
      }
    }
  };
}