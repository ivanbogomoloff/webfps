Разберу процесс пошагово — сначала в Blender, затем в Three.js.


## В Blender 3D

**Шаг 1. Добавьте пустой объект (Empty) в нужное место**

1. Перейдите в **Object Mode**.
2. Нажмите `Shift + A` → **Empty** → выберите тип (например, **Plain Axes** или **Sphere** — визуальное отображение поможет ориентироваться).
3. Переместите пустой объект (`G`) в точку крепления оружия на модели игрока (например, к руке).
4. При необходимости поверните (`R`) и масштабируйте (`S`) объект для удобства восприятия.

**Шаг 2. Назовите объект**

1. В панели **Outliner** (обычно справа) найдите созданный пустой объект.
2. Переименуйте его в `socket` (или `weapon_socket`, если нужно несколько точек крепления).

**Шаг 3. Свяжите Empty с костями скелета (если модель анимирована)**

Если у модели есть скелет (Armature), привяжите Empty к нужной кости:

1. Выделите сначала пустой объект, затем — модель игрока (чтобы она была активной, подсвечена жёлтым).
2. Перейдите в **Pose Mode** и выберите кость, к которой хотите привязать сокет (например, кость руки).
3. Нажмите `Ctrl + P` → **Bone**. Теперь Empty будет следовать за костью при анимации.

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

**Шаг 2. Найдите объект `socket`**

После загрузки найдите пустой объект по имени:

```javascript
// Функция для поиска объекта по имени
function findSocket(model, socketName = 'socket') {
  let socket = null;
  model.traverse((child) => {
    if (child.name === socketName) {
      socket = child;
    }
  });
  return socket;
}

// Использование
const weaponSocket = findSocket(window.playerModel, 'socket');
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

  // Добавьте модель оружия как дочерний объект к сокету
  weaponSocket.add(weaponModel);

  // При необходимости настройте положение/поворот оружия относительно сокета
  weaponModel.position.set(0, 0, 0); // Смещение относительно точки крепления
  weaponModel.rotation.set(0, 0, 0);
});
```

**Шаг 4. Обновляйте сцену при анимации**

Если модель игрока анимирована, сокет будет автоматически следовать за костью. Оружие, будучи дочерним объектом сокета, также будет двигаться вместе с ним.

---

## Важные нюансы

* **Именование.** Убедитесь, что имя сокета в Blender (`socket`) точно совпадает с именем, которое вы ищете в Three.js.
* **Масштабы.** Проверьте, совпадают ли масштабы модели игрока и оружия. Возможно, потребуется масштабировать оружие: `weaponModel.scale.set(0.5, 0.5, 0.5)`.
* **Ориентация.** Оружие может быть повёрнуто не в ту сторону. Настройте `weaponModel.rotation` после добавления в сокет.
* **Формат экспорта.** GLTF/GLB предпочтительнее для Three.js: он лучше поддерживает иерархию объектов и анимации.
* **Оптимизация.** Если точек крепления много, можно создать массив сокетов:
  ```javascript
  const sockets = {
    rightHand: findSocket(playerModel, 'right_hand_socket'),
    leftHand: findSocket(playerModel, 'left_hand_socket')
  };
  ```
