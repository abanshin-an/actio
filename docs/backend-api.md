# Backend API (actio)

Документ описывает HTTP API web-backend (`src/server/server.js`) и контракт каналов `invoke` (`src/main/backend-core.js`).

## Base URL

- По умолчанию: `http://localhost:3010`
- Настраивается через env:
  - `ACTIO_HOST` (default: `0.0.0.0`)
  - `ACTIO_PORT` (default: `3010`)

## Общий формат ответов

- Успех:

```json
{ "ok": true, "data": {} }
```

- Ошибка:

```json
{ "ok": false, "error": "message" }
```

## HTTP Endpoints

### `GET /api/health`

Проверка доступности backend.

Ответ:

```json
{ "ok": true, "data": { "status": "ok" } }
```

### `POST /api/invoke`

Универсальный RPC endpoint.

Request body:

```json
{
  "channel": "tasks:update",
  "payload": { "taskId": 1, "patch": { "subject": "Updated" } }
}
```

### `POST /api/timer-state`

Обновление runtime-состояния таймера (используется клиентом).

Request body:

```json
{
  "running": true,
  "kind": "work",
  "taskId": 12,
  "sessionStartedAt": "2026-03-11T09:00:00.000Z",
  "remainingSec": 1200,
  "plannedDurationSec": 1500
}
```

## Каналы `/api/invoke`

Ниже перечислены поддерживаемые `channel`.

### Board

- `board:load`
  - payload: объект фильтров (или `{}`)
  - result: board snapshot (`columns`, `projects`, `categories`, `settings`, `activeTask`)

### Columns

- `columns:create`
  - payload: `{ "title": "My Column" }`
- `columns:delete`
  - payload: `{ "columnId": 123 }`
- `columns:reorder`
  - payload: `{ "orderedIds": [1,2,3] }`

### Projects

- `projects:list`
  - payload: `{}`
- `projects:create`
  - payload: `{ "name": "Project A" }`

### Categories

- `categories:list`
  - payload: `{}`
- `categories:create`
  - payload: `{ "name": "Category A" }`

### Tasks

- `tasks:create`
  - payload: объект задачи (например: `subject`, `descriptionMd`, `result`, `priority`, `scheduledAt`, `startDate`, `endDate`, `plannedPomodoros`, `columnId`, `projectId/projectName`, `categoryIds`)
- `tasks:update`
  - payload: `{ "taskId": 1, "patch": { ... } }`
- `tasks:delete`
  - payload: `{ "taskId": 1 }`
- `tasks:move`
  - payload: `{ "taskId": 1, "toColumnId": 2 }`
- `tasks:reorder`
  - payload: `{ "columnId": 2, "orderedTaskIds": [8,5,3] }`
- `tasks:get`
  - payload: `{ "taskId": 1 }`
- `tasks:set-active`
  - payload: `{ "taskId": 1 }`
- `tasks:clear-active`
  - payload: `{ "taskId": 1 }` или `{}`
- `tasks:complete`
  - payload: `{ "taskId": 1 }`
- `tasks:interrupt`
  - payload: `{ "taskId": 1 }`
- `tasks:increment-spent`
  - payload: `{ "taskId": 1, "amount": 1, "source": "manual|pomodoro|mark_done" }`

### Backlog

- `backlog:add`
  - payload: `{ "taskId": 1 }`
- `backlog:list`
  - payload: `{ "filters": { ... } }`
- `backlog:move`
  - payload: `{ "taskId": 1, "toColumnId": 2 }`

### Todo.txt

- `todotxt:add`
  - payload: `{ "line": "(A) Task +Project @ctx due:2026-03-12" }`

### Pomodoro / Calendar

- `pomodoro:record`
  - payload: `{ "taskId": 1, "kind": "work|break", "durationMinutes": 25, "startedAt": "...", "endedAt": "...", "wasInterrupted": false }`
- `calendar:sessions`
  - payload: `{ "from": "ISO", "to": "ISO" }`
- `calendar:scheduled`
  - payload: `{ "from": "ISO", "to": "ISO" }`

### Settings / Sync

- `settings:get`
  - payload: `{}`
- `settings:update`
  - payload: `{ "patch": { "theme": "light", "language": "ru" } }`
- `sync:get-state`
  - payload: `{}`
  - result: `{ "revision": number, "updatedAt": "ISO" }`

### DB Profiles

- `db:profiles:list`
  - payload: `{}`
- `db:profiles:choose-path`
  - payload: `{}`
  - в web-режиме может вернуть ошибку (`Choosing database path is not available in web mode`)
- `db:profiles:add`
  - payload: `{ "dbPath": "/abs/path/to/file.sqlite" }`
- `db:profiles:create-empty`
  - payload: `{ "dbPath": "/abs/path/to/file.sqlite" }`
- `db:profiles:select`
  - payload: `{ "dbPath": "/abs/path/to/file.sqlite" }`

### Analytics

- `analytics:get`
  - payload: `{ "filters": { ... } }`

### Archive

- `archive:list`
  - payload: `{ "filters": { ... } }`
- `archive:clone-to-inbox`
  - payload: `{ "archiveId": 10 }`
- `archive:delete`
  - payload: `{ "archiveId": 10 }`

### App / Shell

- `app:startup-state`
  - payload: `{}`
- `shell:open-external`
  - payload: `{ "url": "https://example.com" }`

### Timer runtime (через invoke)

- `timer:state`
  - payload: как в `POST /api/timer-state`

## Примеры curl

### Получить board

```bash
curl -s http://localhost:3010/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{"channel":"board:load","payload":{}}'
```

### Создать задачу

```bash
curl -s http://localhost:3010/api/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "channel":"tasks:create",
    "payload":{
      "subject":"API task",
      "descriptionMd":"Created via API",
      "plannedPomodoros":1
    }
  }'
```

### Обновить таймер runtime

```bash
curl -s http://localhost:3010/api/timer-state \
  -H 'Content-Type: application/json' \
  -d '{"running":true,"kind":"work","taskId":1,"remainingSec":1200,"plannedDurationSec":1500}'
```

## Ограничения и безопасность

- Аутентификация в текущей реализации отсутствует.
- CORS: `Access-Control-Allow-Origin: *`.
- Для прод/внешнего доступа рекомендуется reverse proxy + auth + TLS.
