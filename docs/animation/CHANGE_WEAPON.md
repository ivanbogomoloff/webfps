# Смена оружия: где запускается анимация

Этот документ описывает текущую архитектуру смены оружия в клиенте и путь, по которому запускаются FP-анимации `hide` и `pick`.

## Ключевые файлы

- `client/src/ecs/systems/WeaponLoadoutSystem.ts`
- `client/src/ecs/systems/PlayerControllerSystem.ts`
- `client/src/ecs/systems/WeaponPoseByLocomotionSystem.ts`
- `client/src/ecs/systems/LocalPlayerSystem.ts`
- `client/src/config/weapons/types.ts`
- `client/src/game/weapon/weaponModelTemplates.ts`

## Поток при смене оружия (hotkeys 1..9)

1. Игрок нажимает hotkey в `WeaponLoadoutSystem`.
2. Если смена допустима, система переводит `weaponState` в состояние переключения:
   - `isSwitching = true`
   - `switchPhase = 'hide'`
   - `switchRemainingSec = pickTimeSec / 2`
   - `pendingWeaponId` и `pendingAmmoInMag` заполняются целевым оружием
   - `action = 'hide'`
3. На каждом кадре `PlayerControllerSystem` уменьшает таймеры переключения.
4. Когда фаза `hide` заканчивается:
   - применяется `pendingWeaponId` через `applyWeaponDefinition(...)`
   - запускается фаза `pick` (`switchPhase = 'pick'`, `action = 'pick'`).
5. Когда `pick` завершается, `isSwitching` сбрасывается, и `action` возвращается к обычному (`walk/run` или другому по контексту).

## Где выбирается ключ анимации

`WeaponPoseByLocomotionSystem` берёт:

- `playerController.locomotion`
- `weaponState.action`

и маппит их в `WeaponAnimationPoseKey` через
`resolveWeaponAnimationPoseKey(...)` из `client/src/config/weapons/types.ts`.

Там для смены оружия есть явные правила:

- `weaponAction === 'hide'` -> ключ `hide`
- `weaponAction === 'pick'` -> ключ `pick`

## Где реально запускается клип

В `WeaponPoseByLocomotionSystem`:

1. Для FP-модели создаётся `AnimationMixer`.
2. Из модели читаются клипы (`getWeaponVisualAnimations(...)`).
3. Для каждого ключа (`idle|walk|run|fire|reload|hide|pick`) пытается найти подходящий клип по имени.
4. `playFpAnimationForKey(...)` останавливает предыдущий action и запускает новый (`reset + play`).
5. Если клипа для ключа нет, используется fallback-поза из `fpPlacementByAnimation`.

Важно: клипы берутся из загруженного GLTF через `weaponModelTemplates` и привязываются к cloned visual через `WeakMap`.

## Видимость FP-модели во время hide

В `LocalPlayerSystem` управляется видимость FP-оружия:

- обычное правило: `action === 'hide'` скрывает FP-модель;
- исключение для смены оружия: если `isSwitching && switchPhase === 'hide'`, FP-модель оставляется видимой, чтобы `hide`-клип был виден игроку.

Именно это исключение нужно для корректного визуального проигрывания `hide` во время weapon switch.

## Быстрый чеклист, если hide/pick не играет

- В GLTF оружия действительно есть клипы с именем `hide`/`pick` (или именами, содержащими эти подстроки).
- Для локального игрока обновляется `weaponState.action` (`hide` -> `pick`).
- `WeaponPoseByLocomotionSystem` подключен в порядке систем и получает `weaponVisualFpObject`.
- FP-модель не скрыта в фазе `hide` (см. логику в `LocalPlayerSystem`).
- Для модели не сработал fallback-меш без анимаций (проверить загрузку в `weaponModelTemplates`).
