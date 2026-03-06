# actio

Desktop-приложение на `Electron + SQLite` для управления задачами по канбану, отслеживания работы по технике Pomodoro и анализа производительности.

## Стек

- `Electron` (desktop shell + IPC)
- `Vanilla JS (ES modules)` (интерфейс)
- `better-sqlite3` (локальная БД SQLite)

## Запуск

```bash
npm install
npm run start
```

## Запуск в Docker

Проект можно запускать через:

```bash
docker compose up --build
```

После старта откройте в браузере:

- `http://localhost:6080` (noVNC)
- если не открылось по корню: `http://localhost:6080/vnc.html`

В контейнере поднимается виртуальный X-сервер (`Xvfb`) и `noVNC`, поэтому установка
`XQuartz`/`xhost` на macOS не требуется.

## Реализовано

- 4 вкладки: `Канбан`, `Помодоро`, `Анализ`, `Настройки`
- Обязательные колонки: `Inbox`, `Organise`, `Wait`, `Process`, `Done`
- Добавление/удаление пользовательских колонок
- Карточки задач с drag&drop между колонками
- Перестановка самих колонок через drag&drop (по drag-handle в заголовке колонки)
- Цвет карточек, markdown-описание, дополнительные атрибуты `key:value`
- CRUD задач + выбор активной задачи для исполнения
- Быстрый ввод задач в формате `todo.txt` в `Inbox` с извлечением:
  - приоритета
  - дат создания/завершения
  - контекстов `@`
  - проектов `+`
  - ключей/значений `key:value`
- Хранение колонок/задач/проектов/категорий/приоритетов/сессий в SQLite
- Помодоро-таймер:
  - по умолчанию `25/5`, длинный перерыв `30` после 4 помидоров
  - диалог после завершения помидора (перерыв или следующий помидор)
  - авто-запуск следующего помидора через 10 секунд без ответа
  - отметить задачу завершенной / прервать выполнение
- Аналитика:
  - heatmap выполненных помидоров по дням
  - Lead Time
  - throughput (задачи/помидоры)
  - WIP по дням (30 дней)
  - отклонение план/факт по помидорам
  - фильтры по проекту/категории/приоритету
- Настройки:
  - длительности помидора и перерывов
  - тема `light/dark`
  - язык `ru/en`

## Структура

- `src/main/main.js` — Electron main + IPC handlers
- `src/main/preload.cjs` — безопасный bridge API в renderer
- `src/main/db.js` — схема SQLite и бизнес-логика
- `src/main/todotxt.js` — парсер todo.txt
- `src/renderer/index.html` — UI
- `src/renderer/styles.css` — стили
- `src/renderer/app.js` — клиентская логика
- `.github/workflows/build-installers.yml` — CI сборка установщиков для macOS/Windows/Linux

## Сборка установщиков

```bash
# Подготовка зависимостей
npm install

# Упаковка без инсталлятора (проверка)
npm run pack

# Установщики по платформам
npm run dist:mac
npm run dist:win
npm run dist:linux

# По архитектурам
npm run dist:mac:x64
npm run dist:mac:arm64
npm run dist:win:x64
npm run dist:win:arm64
npm run dist:linux:x64
npm run dist:linux:arm64

# Собрать обе архитектуры для конкретной платформы
npm run dist:mac:all
npm run dist:win:all
npm run dist:linux:all

# Альтернатива для macOS (если DMG недоступен в окружении)
npm run dist:mac:zip
```

Артефакты сборки складываются в папку `release/`.

## Авто-релиз по тегу

Настроен workflow `Build And Release`:

1. Создайте и отправьте тег версии:

```bash
git tag v0.1.0
git push origin v0.1.0
```

2. GitHub Actions автоматически:
- соберет native-артефакты для macOS/Windows/Linux (x64 + arm64),
- создаст GitHub Release по тегу,
- прикрепит к релизу установщики (`.dmg`, `.exe`, `.AppImage`, `.deb`).

## Хранение данных

- SQLite-база хранится в постоянной директории:
  - `macOS/Linux/Windows`: `<appData>/actio/actio.sqlite`
- При первом запуске автоматически выполняется миграция из legacy-пути (`userData`) в новый путь.
