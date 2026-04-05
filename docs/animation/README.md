Разберу процесс пошагово — сначала в Blender, затем в Three.js.

## Эталон для Blender + glTF

Чтобы оружие крепилось к сокету без дополнительного кода с оффсетами/поворотами, используйте единый стандарт:

- На модели игрока сокет правой руки называется `socket_weapon_r`.
- На модели оружия есть узел хвата `socket_grip_r` (или `weapon_root`).
- Для обоих узлов в Blender:
  - `+Y` направлен вдоль ствола к дулу (forward в Blender),
  - `+Z` вверх,
  - `+X` вправо.
- После экспорта в glTF/Three.js это соответствует:
  - `-Z` forward,
  - `+Y` up,
  - `+X` right.

Важно: у Armature, меша игрока и узла оружия должны быть применены трансформации (`Ctrl + A` -> **Rotation & Scale**), чтобы в файле оставались `scale=1` и `rotation=0`.


## В Blender 3D

**Шаг 1. Добавьте пустой объект (Empty) в нужное место**

1. Перейдите в **Object Mode**.
2. Нажмите `Shift + A` → **Empty** → выберите тип (например, **Plain Axes** или **Sphere** — визуальное отображение поможет ориентироваться).
3. Переместите пустой объект (`G`) в точку крепления оружия на модели игрока (например, к руке).
4. При необходимости поверните (`R`) и масштабируйте (`S`) объект для удобства восприятия.

**Шаг 2. Назовите объект**

1. В панели **Outliner** (обычно справа) найдите созданный пустой объект.
2. Переименуйте его в `socket_weapon_r`.

**Шаг 3. Свяжите Empty с костями скелета (если модель анимирована)**

Если у модели есть скелет (Armature), привяжите Empty к нужной кости:

1. Выделите сначала пустой объект, затем — модель игрока (чтобы она была активной, подсвечена жёлтым).
2. Перейдите в **Pose Mode** и выберите кость, к которой хотите привязать сокет (например, кость руки).
3. Нажмите `Ctrl + P` → **Bone**. Теперь Empty будет следовать за костью при анимации.
4. Для сокета выставьте в Bone/Object настройки без наследования неравномерного масштаба (рекомендуется `Inherit Scale: None`), чтобы дочернее оружие не сжималось из-за масштаба рига.

**Шаг 3.1 (рекомендуется). Подготовьте точку хвата в модели оружия**

1. В файле оружия добавьте Empty или root-узел `socket_grip_r` (или `weapon_root`) в месте хвата рукоятки.
2. Сделайте меш оружия дочерним к этому узлу.
3. Выставьте оси узла по эталону выше (`+Y` в сторону дула, `+Z` вверх, `+X` вправо).
4. Примените `Ctrl + A` → **Rotation & Scale** для оружия и узла хвата.

**Шаг 4. Экспорт модели**

1. Убедитесь, что модель игрока, скелет (если есть) и пустой объект `socket` находятся в одной коллекции или сцене.
2. Выберите все необходимые объекты.
3. Перейдите в меню **File** → **Export** → выберите формат (рекомендуется **FBX** или **GLTF/GLB** для Three.js).
4. В настройках экспорта убедитесь, что:
    * включены опции **Include** для **Meshes**, **Armatures** и **Empties**;
    * для FBX: **Bake Animation** (если нужна анимация), **Apply Transform**;
    * для GLTF: **Export Animations** (если нужно), **Include Normals**, **Include UVs**.
5. Сохраните файл.

---

## В Three.js

**Шаг 1. Загрузите модель**

Используйте `GLTFLoader` или `FBXLoader`:

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('path/to/your/model.glb', (gltf) => {
  const playerModel = gltf.scene;
  scene.add(playerModel);
  // Сохраняем ссылку на модель для дальнейшего использования
  window.playerModel = playerModel;
});
```

**Шаг 2. Найдите объект `socket_weapon_r`**

После загрузки найдите пустой объект по имени:

```javascript
// Функция для поиска объекта по имени
function findSocket(model, socketName = 'socket_weapon_r') {
  let socket = null;
  model.traverse((child) => {
    if (child.name === socketName) {
      socket = child;
    }
  });
  return socket;
}

// Использование
const weaponSocket = findSocket(window.playerModel, 'socket_weapon_r');
if (!weaponSocket) {
  console.warn('Socket not found!');
  return;
}
```

**Шаг 3. Загрузите модель оружия**

Аналогично загрузите модель оружия:

```javascript
loader.load('path/to/weapon.glb', (weaponGltf) => {
  const weaponModel = weaponGltf.scene;

  // Если в оружии есть узел хвата socket_grip_r, крепим именно его (или weapon_root)
  const grip = weaponModel.getObjectByName('socket_grip_r') ?? weaponModel;
  weaponSocket.add(grip);

  // При соблюдении эталона осей и применённых трансформациях
  // дополнительные повороты/оффсеты обычно не нужны
  grip.position.set(0, 0, 0);
  grip.rotation.set(0, 0, 0);
});
```

**Шаг 4. Обновляйте сцену при анимации**

Если модель игрока анимирована, сокет будет автоматически следовать за костью. Оружие, будучи дочерним объектом сокета, также будет двигаться вместе с ним.

---

## Важные нюансы

* **Именование.** Для правой руки используйте стабильное имя `socket_weapon_r`; для оружия — `socket_grip_r`/`weapon_root`.
* **Масштабы.** Не полагайтесь на компенсацию в коде: применяйте `Ctrl + A` (Rotation & Scale) в Blender, чтобы не получить `mountScale=0.01`.
* **Ориентация.** Если оси `socket_weapon_r` и `socket_grip_r` совпадают по эталону, ручная докрутка `rotation` в Three.js не нужна.
* **Формат экспорта.** GLTF/GLB предпочтительнее для Three.js: он лучше поддерживает иерархию объектов и анимации.
* **Оптимизация.** Если точек крепления много, можно создать массив сокетов:
  ```javascript
  const sockets = {
    rightHand: findSocket(playerModel, 'socket_weapon_r'),
    leftHand: findSocket(playerModel, 'left_hand_socket')
  };
  ```

---

## Weapon poses by locomotion (текущий проект)

В проекте позиция/поворот/масштаб оружия теперь задаются по ключам локомоции игрока:

- типы и список ключей: `client/src/config/weapons/types.ts` (`PLAYER_LOCOMOTION_KEYS`);
- конфиг оружия по файлам: `client/src/config/weapons/rifle_m16.ts`, `client/src/config/weapons/rifle_ak47.ts`;
- gameplay-каталог оружия: `client/src/config/weaponCatalog.ts` (урон/скорострельность/магазин).

### Формат

Для каждого оружия используется структура:

```ts
{
  id: 'm16',
  placementByLocomotion: {
    idle: { position: ..., rotation: ..., scale: ... },
    walk: { ... },
    // ... остальные ключи PlayerLocomotion
  }
}
```

`placementByLocomotion` должен содержать полный набор ключей `PlayerLocomotion`.

### Как добавить/изменить позицию под анимацию

1. Открой файл оружия в `client/src/config/weapons/<weapon>.ts`.
2. Оставь базу через `createUniformWeaponPlacement(...)` или задай все ключи вручную.
3. Переопредели нужный ключ (например `idle`, `walk`, `run_forward`) в `placementByLocomotion`.
4. Сохрани и проверь в игре/вьювере.

Пример:

```ts
const base = createUniformWeaponPlacement({
  position: { x: 0.12, y: 0.02, z: -0.02 },
  rotation: { x: Math.PI / 2, y: -Math.PI / 2, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
})

export const rifle_m16ModelConfig = {
  id: 'colt_m4a1_low-poly',
  placementByLocomotion: {
    ...base,
    idle: {
      position: { x: 0.11, y: 0.03, z: -0.01 },
      rotation: { x: 1.57, y: -1.57, z: 0.08 },
      scale: { x: 1, y: 1, z: 1 },
    },
  },
}
```

### Workflow через Player Viewer

1. Открой `http://localhost:3000/tools/pv`.
2. Выбери оружие (`Weapon.model`) и анимацию (`Animation.clip`).
3. Выбери ключ для записи в конфиг (`Weapon.pose key`).
4. Подбери `pos/rot/scale`.
5. Нажми `copy` и вставь блок в `placementByLocomotion` нужного файла оружия.

Подсказка: если имя клипа совпадает с ключом локомоции (`idle`, `walk`, `run_forward`, ...), viewer автоматически подставит соответствующий `pose key`.
