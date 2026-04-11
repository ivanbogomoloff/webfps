import { World } from 'miniplex';

export function createInputSystem(world: World) {
  // Глобальные хранилища состояния ввода
  const globalKeys = new Map<string, boolean>();
  let globalMouseX = 0;
  let globalMouseY = 0;
  let globalMouseDeltaX = 0;
  let globalMouseDeltaY = 0;
  let globalMouseLocked = false;
  let globalPrimaryMouseDown = false;
  // Игнорируем keyup сразу после входа в pointer lock (браузер шлёт синтетические keyup при смене фокуса)
  let ignoreKeyUpUntil = 0;
  const keyUpAllowDuringIgnore = new Set<string>();
  const MOVEMENT_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];

  const clearAllKeys = () => {
    for (const key of Array.from(globalKeys.keys())) {
      globalKeys.set(key, false);
    }
    keyUpAllowDuringIgnore.clear();
  };

  const clearMovementKeys = () => {
    for (const key of MOVEMENT_KEYS) {
      globalKeys.set(key, false);
      keyUpAllowDuringIgnore.delete(key);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (e.key === 'Tab') {
      e.preventDefault();
    }
    globalKeys.set(key, true);
    keyUpAllowDuringIgnore.add(key);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (e.key === 'Tab') {
      e.preventDefault();
    }
    if (Date.now() < ignoreKeyUpUntil && !keyUpAllowDuringIgnore.has(key)) return;
    globalKeys.set(key, false);
    keyUpAllowDuringIgnore.delete(key);
  };
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  window.addEventListener('mousemove', (e) => {
    globalMouseDeltaX = e.movementX;
    globalMouseDeltaY = e.movementY;
    globalMouseX = e.clientX;
    globalMouseY = e.clientY;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      globalPrimaryMouseDown = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      globalPrimaryMouseDown = false;
    }
  });
  window.addEventListener('blur', () => {
    globalPrimaryMouseDown = false;
    clearAllKeys();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      globalPrimaryMouseDown = false;
      clearAllKeys();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement !== null;
    if (locked) {
      ignoreKeyUpUntil = Date.now() + 150;
      keyUpAllowDuringIgnore.clear();
      for (const [key, isDown] of globalKeys) {
        if (isDown) {
          keyUpAllowDuringIgnore.add(key);
        }
      }
    } else {
      // При выходе из pointer lock браузер может потерять keyup, сбрасываем движение принудительно.
      clearMovementKeys();
    }
    globalMouseLocked = locked;
  });

  return (_deltaTime: number) => {
    // Обновляем состояние ввода для всех сущностей с компонентом input
    for (const entity of world.with('input')) {
      const input = entity.input as any;
      
      // Копируем глобальные клавиши в локальный Map (не переписываем, обновляем значения)
      for (const [key, value] of globalKeys) {
        input.keys.set(key, value);
      }
      
      input.mouse.x = globalMouseX;
      input.mouse.y = globalMouseY;
      input.mouse.deltaX = globalMouseDeltaX;
      input.mouse.deltaY = globalMouseDeltaY;
      input.mouse.isLocked = globalMouseLocked;
      input.mouse.primaryDown = globalPrimaryMouseDown;
    }

    // Обнуляем дельта после обновления
    globalMouseDeltaX = 0;
    globalMouseDeltaY = 0;
  };
}
