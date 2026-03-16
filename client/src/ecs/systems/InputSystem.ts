import { World } from 'miniplex';

export function createInputSystem(world: World) {
  // Глобальные хранилища состояния ввода
  const globalKeys = new Map<string, boolean>();
  let globalMouseX = 0;
  let globalMouseY = 0;
  let globalMouseDeltaX = 0;
  let globalMouseDeltaY = 0;
  let globalMouseLocked = false;
  // Игнорируем keyup сразу после входа в pointer lock (браузер шлёт синтетические keyup при смене фокуса)
  let ignoreKeyUpUntil = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    globalKeys.set(e.key.toLowerCase(), true);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (Date.now() < ignoreKeyUpUntil) return;
    globalKeys.set(e.key.toLowerCase(), false);
  };
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  window.addEventListener('mousemove', (e) => {
    globalMouseDeltaX = e.movementX;
    globalMouseDeltaY = e.movementY;
    globalMouseX = e.clientX;
    globalMouseY = e.clientY;
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement !== null;
    if (locked) {
      ignoreKeyUpUntil = Date.now() + 150;
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
    }

    // Обнуляем дельта после обновления
    globalMouseDeltaX = 0;
    globalMouseDeltaY = 0;
  };
}
