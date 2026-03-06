import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell, screen, dialog } from "electron";
import { AppDatabase } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let db = null;
let allowWindowClose = false;
let closeFlowInProgress = false;
let startupState = {
  wasUncleanShutdown: false
};
let timerRuntimeState = {
  running: false,
  kind: "work",
  taskId: null,
  sessionStartedAt: null,
  remainingSec: 0,
  plannedDurationSec: 0
};
let currentDbPath = null;

function persistTimerRuntimeState() {
  if (!db) return;
  try {
    db.updateSettings({
      timerRuntimeRunning: timerRuntimeState.running ? "1" : "0",
      timerRuntimeKind: timerRuntimeState.kind === "break" ? "break" : "work",
      timerRuntimeTaskId: timerRuntimeState.taskId ? String(timerRuntimeState.taskId) : "",
      timerRuntimeSessionStartedAt: timerRuntimeState.sessionStartedAt || "",
      timerRuntimeRemainingSec: String(Math.max(0, Number(timerRuntimeState.remainingSec || 0))),
      timerRuntimePlannedDurationSec: String(Math.max(0, Number(timerRuntimeState.plannedDurationSec || 0)))
    });
  } catch (_error) {
    // Best-effort persistence.
  }
}

function setTimerRuntimeState(payload = {}) {
  timerRuntimeState = {
    running: Boolean(payload.running),
    kind: payload.kind === "break" ? "break" : "work",
    taskId: Number(payload.taskId || 0) || null,
    sessionStartedAt: payload.sessionStartedAt ? String(payload.sessionStartedAt) : null,
    remainingSec: Math.max(0, Number(payload.remainingSec || 0)),
    plannedDurationSec: Math.max(0, Number(payload.plannedDurationSec || 0))
  };
  persistTimerRuntimeState();
}

async function fallbackInterruptActiveTimer() {
  if (!db || !timerRuntimeState.running) return;

  const now = new Date();
  const startedAt = timerRuntimeState.sessionStartedAt || now.toISOString();
  const startedMs = new Date(startedAt).getTime();
  const elapsedSec = Number.isFinite(startedMs)
    ? Math.max(1, Math.round((now.getTime() - startedMs) / 1000))
    : 1;

  try {
    db.recordPomodoroSession({
      taskId: timerRuntimeState.taskId,
      kind: timerRuntimeState.kind,
      durationMinutes: Math.max(1, Math.round(elapsedSec / 60)),
      startedAt,
      endedAt: now.toISOString(),
      wasInterrupted: true
    });
  } catch (_error) {
    // Best-effort fallback when renderer is unavailable.
  }

  if (timerRuntimeState.kind === "work" && timerRuntimeState.taskId) {
    try {
      db.interruptTask(timerRuntimeState.taskId);
    } catch (_error) {
      // Best-effort fallback when renderer is unavailable.
    }
  }

  setTimerRuntimeState({ running: false });
}

function waitForShutdownInterruptAck(windowRef, timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (!windowRef || windowRef.isDestroyed() || windowRef.webContents.isDestroyed()) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      ipcMain.removeListener("app:shutdown-interrupt-complete", onAck);
      resolve(value);
    };

    const onAck = (event) => {
      if (event.sender.id !== windowRef.webContents.id) return;
      finish(true);
    };

    const timeoutId = setTimeout(() => finish(false), timeoutMs);
    ipcMain.on("app:shutdown-interrupt-complete", onAck);

    try {
      windowRef.webContents.send("app:shutdown-interrupt");
    } catch (_error) {
      finish(false);
    }
  });
}

function getDbProfilesFilePath() {
  return path.join(app.getPath("appData"), "actio", "db-profiles.json");
}

function getDefaultDatabasePath() {
  const targetPath = path.join(app.getPath("appData"), "actio", "actio-demo.sqlite");
  const bundledDemoCandidates = [
    path.join(process.cwd(), "demo-data", "actio-demo.sqlite"),
    path.join(app.getAppPath(), "demo-data", "actio-demo.sqlite")
  ];
  const legacyPath = path.join(app.getPath("userData"), "kanban-pomodoro.sqlite");

  if (targetPath === legacyPath) {
    return targetPath;
  }

  if (!fs.existsSync(targetPath)) {
    for (const sourcePath of bundledDemoCandidates) {
      if (!fs.existsSync(sourcePath)) continue;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      break;
    }
  }

  if (!fs.existsSync(targetPath) && fs.existsSync(legacyPath)) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(legacyPath, targetPath);

    for (const suffix of ["-wal", "-shm"]) {
      const legacyExtra = `${legacyPath}${suffix}`;
      const targetExtra = `${targetPath}${suffix}`;
      if (fs.existsSync(legacyExtra) && !fs.existsSync(targetExtra)) {
        fs.copyFileSync(legacyExtra, targetExtra);
      }
    }
  }

  return targetPath;
}

function normalizeDatabasePath(dbPath) {
  const raw = String(dbPath || "").trim();
  if (!raw) {
    throw new Error("Database path is required");
  }
  return path.resolve(raw);
}

function readDbProfiles() {
  const filePath = getDbProfilesFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function writeDbProfiles(payload) {
  const filePath = getDbProfilesFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function ensureDbProfiles() {
  const defaultPath = normalizeDatabasePath(getDefaultDatabasePath());
  const existing = readDbProfiles();
  const paths = Array.isArray(existing?.paths)
    ? existing.paths
      .map((p) => String(p || "").trim())
      .filter(Boolean)
      .map((p) => normalizeDatabasePath(p))
    : [];

  if (!paths.includes(defaultPath)) {
    paths.unshift(defaultPath);
  }

  const selectedPath = existing?.selectedPath && paths.includes(normalizeDatabasePath(existing.selectedPath))
    ? normalizeDatabasePath(existing.selectedPath)
    : paths[0];

  const payload = { selectedPath, paths: Array.from(new Set(paths)) };
  writeDbProfiles(payload);
  return payload;
}

function listDbProfiles() {
  const payload = ensureDbProfiles();
  return {
    selectedPath: payload.selectedPath,
    currentPath: currentDbPath || payload.selectedPath,
    profiles: payload.paths.map((p) => ({
      path: p,
      label: path.basename(p) || p
    }))
  };
}

async function chooseDatabasePath() {
  const defaultPath = currentDbPath || getDefaultDatabasePath();
  const result = await dialog.showSaveDialog(mainWindow || undefined, {
    title: "Выберите путь файла БД",
    defaultPath,
    filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled) return "";
  return normalizeDatabasePath(result.filePath || "");
}

function addDbProfile(dbPath) {
  const normalized = normalizeDatabasePath(dbPath);
  const payload = ensureDbProfiles();
  if (!payload.paths.includes(normalized)) {
    payload.paths.push(normalized);
  }
  payload.selectedPath = normalized;
  writeDbProfiles(payload);
  return listDbProfiles();
}

function createEmptyDbProfile(dbPath) {
  const normalized = normalizeDatabasePath(dbPath);
  if (fs.existsSync(normalized) && fs.statSync(normalized).size > 0) {
    throw new Error("Database file already exists and is not empty");
  }

  fs.mkdirSync(path.dirname(normalized), { recursive: true });
  const tempDb = new AppDatabase(normalized);
  tempDb.close();

  return addDbProfile(normalized);
}

function switchDatabase(dbPath) {
  if (timerRuntimeState.running) {
    throw new Error("Stop active timer before switching database");
  }

  const normalized = normalizeDatabasePath(dbPath);
  const payload = ensureDbProfiles();
  if (!payload.paths.includes(normalized)) {
    payload.paths.push(normalized);
  }
  payload.selectedPath = normalized;
  writeDbProfiles(payload);

  if (currentDbPath !== normalized) {
    if (db) {
      db.updateSettings({
        appSessionRunning: "0",
        appLastExitedAt: new Date().toISOString()
      });
      db.close();
    }
    db = new AppDatabase(normalized);
    currentDbPath = normalized;
    db.updateSettings({
      appSessionRunning: "1",
      appLastStartedAt: new Date().toISOString()
    });
  }

  startupState = {
    ...(startupState || {}),
    dbPath: currentDbPath,
    timerRuntime: { ...timerRuntimeState }
  };

  return listDbProfiles();
}

function resolveDatabasePath() {
  if (process.env.KANBAN_DB_PATH) {
    return normalizeDatabasePath(process.env.KANBAN_DB_PATH);
  }

  return ensureDbProfiles().selectedPath;
}

function createWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = display?.workArea || { x: 0, y: 0, width: 1460, height: 920 };
  const width = Math.max(1280, Math.min(2200, workArea.width - 24));
  const height = Math.max(720, Math.min(1400, workArea.height - 24));
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: Math.min(1500, workArea.width),
    minHeight: Math.min(760, workArea.height),
    backgroundColor: "#f8fafc",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.on("close", (event) => {
    if (allowWindowClose) return;
    if (!timerRuntimeState.running) return;

    event.preventDefault();
    if (closeFlowInProgress) return;

    const answer = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Прервать и выйти", "Отмена"],
      defaultId: 0,
      cancelId: 1,
      message: "Прервать выполнение текущей задачи?"
    });

    if (answer !== 0) return;

    closeFlowInProgress = true;
    (async () => {
      try {
        const interruptedByRenderer = await waitForShutdownInterruptAck(mainWindow);
        if (!interruptedByRenderer) {
          await fallbackInterruptActiveTimer();
        }
      } finally {
        allowWindowClose = true;
        closeFlowInProgress = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      }
    })();
  });

  mainWindow.webContents.on("render-process-gone", () => {
    void fallbackInterruptActiveTimer();
  });

  mainWindow.webContents.on("unresponsive", () => {
    void fallbackInterruptActiveTimer();
  });
}


function handle(channel, callback) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return {
        ok: true,
        data: await callback(payload)
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Unknown error"
      };
    }
  });
}

function registerIpcHandlers() {
  handle("board:load", (filters) => db.loadBoard(filters || {}));

  handle("columns:create", ({ title }) => db.createColumn(title));
  handle("columns:delete", ({ columnId }) => db.deleteColumn(columnId));
  handle("columns:reorder", ({ orderedIds }) => db.reorderColumns(orderedIds));

  handle("projects:list", () => db.listProjects());
  handle("projects:create", ({ name }) => db.createProject(name));

  handle("categories:list", () => db.listCategories());
  handle("categories:create", ({ name }) => db.createCategory(name));

  handle("tasks:create", (payload) => db.createTask(payload));
  handle("tasks:update", ({ taskId, patch }) => db.updateTask(taskId, patch));
  handle("tasks:delete", ({ taskId }) => db.deleteTask(taskId));
  handle("tasks:move", ({ taskId, toColumnId }) => db.moveTask(taskId, toColumnId));
  handle("tasks:reorder", ({ columnId, orderedTaskIds }) =>
    db.reorderTasksInColumn(columnId, orderedTaskIds)
  );
  handle("tasks:get", ({ taskId }) => db.getTaskById(taskId));
  handle("tasks:set-active", ({ taskId }) => db.setActiveTask(taskId));
  handle("tasks:clear-active", ({ taskId }) => db.clearActiveTask(taskId));
  handle("tasks:complete", ({ taskId }) => db.completeTask(taskId));
  handle("tasks:interrupt", ({ taskId }) => db.interruptTask(taskId));
  handle("tasks:increment-spent", ({ taskId, amount, source }) =>
    db.incrementTaskSpent(taskId, amount, source || "manual")
  );
  handle("backlog:add", ({ taskId }) => db.addTaskToBacklog(taskId));
  handle("backlog:list", ({ filters }) => db.listBacklog(filters || {}));
  handle("backlog:move", ({ taskId, toColumnId }) => db.moveTaskFromBacklog(taskId, toColumnId));

  handle("todotxt:add", ({ line }) => db.quickAddTodoTxt(line));

  handle("pomodoro:record", (payload) => db.recordPomodoroSession(payload));
  handle("calendar:sessions", ({ from, to }) => db.listCalendarSessions({ from, to }));
  handle("calendar:scheduled", ({ from, to }) => db.listScheduledCalendarEvents({ from, to }));

  handle("settings:get", () => db.getSettings());
  handle("settings:update", ({ patch }) => db.updateSettings(patch));
  handle("db:profiles:list", () => listDbProfiles());
  handle("db:profiles:choose-path", () => chooseDatabasePath());
  handle("db:profiles:add", ({ dbPath }) => addDbProfile(dbPath));
  handle("db:profiles:create-empty", ({ dbPath }) => createEmptyDbProfile(dbPath));
  handle("db:profiles:select", ({ dbPath }) => switchDatabase(dbPath));

  handle("analytics:get", ({ filters }) => db.getAnalytics(filters || {}));
  handle("archive:list", ({ filters }) => db.listArchive(filters || {}));
  handle("archive:clone-to-inbox", ({ archiveId }) => db.cloneArchiveTaskToInbox(archiveId));
  handle("archive:delete", ({ archiveId }) => db.deleteArchiveTask(archiveId));
  handle("shell:open-external", ({ url }) => shell.openExternal(String(url || "")));
  handle("app:startup-state", () => startupState);

  ipcMain.on("timer:state", (_event, payload) => {
    setTimerRuntimeState(payload || {});
  });
}


app.whenReady().then(() => {
  currentDbPath = resolveDatabasePath();
  db = new AppDatabase(currentDbPath);

  const existingSettings = db.getSettings();
  const previouslyRunning = String(existingSettings.appSessionRunning || "0") === "1";
  setTimerRuntimeState({
    running: String(existingSettings.timerRuntimeRunning || "0") === "1",
    kind: String(existingSettings.timerRuntimeKind || "work") === "break" ? "break" : "work",
    taskId: Number(existingSettings.timerRuntimeTaskId || 0) || null,
    sessionStartedAt: existingSettings.timerRuntimeSessionStartedAt || null,
    remainingSec: Number(existingSettings.timerRuntimeRemainingSec || 0),
    plannedDurationSec: Number(existingSettings.timerRuntimePlannedDurationSec || 0)
  });
  startupState = {
    wasUncleanShutdown: previouslyRunning,
    dbPath: currentDbPath,
    timerRuntime: { ...timerRuntimeState }
  };
  db.updateSettings({
    appSessionRunning: "1",
    appLastStartedAt: new Date().toISOString()
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (timerRuntimeState.running) {
    void fallbackInterruptActiveTimer();
  }
  if (db) {
    db.updateSettings({
      appSessionRunning: "0",
      appLastExitedAt: new Date().toISOString()
    });
    db.close();
  }
});
