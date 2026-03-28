# Web FPS — game server (Go)

HTTP API и WebSocket-сервер для FFA-матчей: комнаты с 4-значным кодом, роли spectator/player, синхронизация позиций и статистики без серверной физики.

## Требования

- **Go 1.23+** (`go version`).

## Запуск

Из каталога `server` (корень Go-модуля):

```bash
go run ./cmd/api
```

Сборка бинарника и запуск:

```bash
go build -o bin/api ./cmd/api
./bin/api
```

Через скрипт (сборка + **фоновый** запуск, логи в `logs/server.log`, PID в `bin/server.pid`):

```bash
./sh/start-server.sh
tail -f logs/server.log
```

В логах сервера видно создание комнат (`[rooms] created room …`), вход игроков и закрытие комнаты.

Остановка: сначала по `bin/server.pid`, иначе по порту (по умолчанию **8080**; должен совпадать с `PORT` при запуске):

```bash
./sh/stop-server.sh
```

По умолчанию сервер слушает порт **8080**.

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|------------|------------|--------------|
| `PORT` | Порт HTTP/WS | `8080` |
| `MAP_MANIFEST_PATH` | Путь к `maps.json` (лимит слотов по карте) | `../shared/maps/maps.json` |

Запуск с кастомным портом:

```bash
PORT=9090 ./sh/start-server.sh
```

## Эндпоинты

- **`GET /healthz`** — проверка живости, ответ: `{"ok":true}`.
- **`GET /ws`** (upgrade до WebSocket) — игровой канал; сообщения — JSON с полями `type` и `payload` (см. [../shared/protocol/ffa-v1.md](../shared/protocol/ffa-v1.md)).

Проверка после старта:

```bash
curl http://localhost:8080/healthz
```

## Архитектура кода

Каталоги следуют типичной раскладке Go-проекта:

| Путь | Роль |
|------|------|
| **`cmd/api/main.go`** | Точка входа: чтение env, создание `rooms.Manager`, `ws.Hub`, регистрация маршрутов и `ListenAndServe`. |
| **`internal/ws/hub.go`** | Принятие WebSocket (`github.com/coder/websocket`), чтение JSON-сообщений, маршрутизация по `type` в методы менеджера комнат. |
| **`internal/rooms/manager.go`** | Комнаты, игроки, клиенты, рассылка событий; лимит игроков по карте из manifest; таймер матча; обработка `join_room`, `spawn_request`, `state_update`, `report_kill` и т.д. |
| **`internal/match/ffa.go`** | Чистая логика окончания FFA: лимит фрагов или истечение времени и выбор победителя. |
| **`internal/protocol/messages.go`** | Константы типов сообщений и структуры payload для парсинга на сервере. |

Поток данных: **клиент → WebSocket → Hub → Manager**; исходящие сообщения формируются в Manager и отправляются всем подключённым клиентам комнаты. Игровая физика на сервере не симулируется — позиции и киллы приходят от клиентов (MVP без античита).

## Зависимости

- [github.com/coder/websocket](https://github.com/coder/websocket) — WebSocket.

Обновление модулей:

```bash
go mod tidy
```
