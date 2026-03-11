import fs from "node:fs";
import path from "node:path";
import { AppDatabase } from "./db.js";

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class BackendCore {
  constructor(options = {}) {
    this.appDataPath = path.resolve(String(options.appDataPath || path.join(process.cwd(), ".actio-data")));
    this.userDataPath = path.resolve(String(options.userDataPath || this.appDataPath));
    this.appPath = path.resolve(String(options.appPath || process.cwd()));
    this.cwd = path.resolve(String(options.cwd || process.cwd()));
    this.openExternal = typeof options.openExternal === "function" ? options.openExternal : null;
    this.chooseDatabasePath = typeof options.chooseDatabasePath === "function"
      ? options.chooseDatabasePath
      : null;

    this.db = null;
    this.currentDbPath = null;
    this.startupState = { wasUncleanShutdown: false };
    this.syncState = {
      revision: 1,
      updatedAt: new Date().toISOString()
    };
    this.timerRuntimeState = {
      running: false,
      kind: "work",
      taskId: null,
      sessionStartedAt: null,
      remainingSec: 0,
      plannedDurationSec: 0
    };
  }

  init() {
    this.currentDbPath = this.resolveDatabasePath();
    this.db = new AppDatabase(this.currentDbPath);

    const existingSettings = this.db.getSettings();
    const previouslyRunning = String(existingSettings.appSessionRunning || "0") === "1";
    this.setTimerRuntimeState({
      running: String(existingSettings.timerRuntimeRunning || "0") === "1",
      kind: String(existingSettings.timerRuntimeKind || "work") === "break" ? "break" : "work",
      taskId: Number(existingSettings.timerRuntimeTaskId || 0) || null,
      sessionStartedAt: existingSettings.timerRuntimeSessionStartedAt || null,
      remainingSec: Number(existingSettings.timerRuntimeRemainingSec || 0),
      plannedDurationSec: Number(existingSettings.timerRuntimePlannedDurationSec || 0)
    });

    this.startupState = {
      wasUncleanShutdown: previouslyRunning,
      dbPath: this.currentDbPath,
      timerRuntime: { ...this.timerRuntimeState }
    };

    this.db.updateSettings({
      appSessionRunning: "1",
      appLastStartedAt: new Date().toISOString()
    });
  }

  stop() {
    if (!this.db) return;
    if (this.timerRuntimeState.running) {
      this.fallbackInterruptActiveTimer();
    }
    this.db.updateSettings({
      appSessionRunning: "0",
      appLastExitedAt: new Date().toISOString()
    });
    this.db.close();
    this.db = null;
  }

  bumpSyncRevision() {
    this.syncState = {
      revision: Math.max(1, Number(this.syncState.revision || 1) + 1),
      updatedAt: new Date().toISOString()
    };
  }

  getSyncState() {
    return { ...this.syncState };
  }

  copySqliteBundleIfMissing(sourcePath, targetPath) {
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return false;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    for (const suffix of ["-wal", "-shm"]) {
      const sourceExtra = `${sourcePath}${suffix}`;
      const targetExtra = `${targetPath}${suffix}`;
      if (fs.existsSync(sourceExtra) && !fs.existsSync(targetExtra)) {
        fs.copyFileSync(sourceExtra, targetExtra);
      }
    }
    return true;
  }

  getDbProfilesFilePath() {
    return path.join(this.appDataPath, "actio", "db-profiles.json");
  }

  getDefaultDatabasePath() {
    const targetPath = path.join(this.appDataPath, "actio", "actio-demo.sqlite");
    const bundledDemoCandidates = [
      path.join(this.cwd, "demo-data", "actio-demo.sqlite"),
      path.join(this.appPath, "demo-data", "actio-demo.sqlite")
    ];
    const legacyPath = path.join(this.userDataPath, "kanban-pomodoro.sqlite");

    if (targetPath === legacyPath) return targetPath;

    if (!fs.existsSync(targetPath)) {
      for (const sourcePath of bundledDemoCandidates) {
        if (this.copySqliteBundleIfMissing(sourcePath, targetPath)) break;
      }
    }

    if (!fs.existsSync(targetPath) && fs.existsSync(legacyPath)) {
      this.copySqliteBundleIfMissing(legacyPath, targetPath);
    }

    return targetPath;
  }

  normalizeDatabasePath(dbPath) {
    const raw = String(dbPath || "").trim();
    if (!raw) throw new Error("Database path is required");
    return path.resolve(raw);
  }

  readDbProfiles() {
    const filePath = this.getDbProfilesFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (_error) {
      return null;
    }
  }

  writeDbProfiles(payload) {
    const filePath = this.getDbProfilesFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  }

  ensureDbProfiles() {
    const defaultPath = this.normalizeDatabasePath(this.getDefaultDatabasePath());
    const existing = this.readDbProfiles();
    const paths = Array.isArray(existing?.paths)
      ? existing.paths
        .map((p) => String(p || "").trim())
        .filter(Boolean)
        .map((p) => this.normalizeDatabasePath(p))
      : [];

    if (!paths.includes(defaultPath)) {
      paths.unshift(defaultPath);
    }

    const selectedPath = existing?.selectedPath && paths.includes(this.normalizeDatabasePath(existing.selectedPath))
      ? this.normalizeDatabasePath(existing.selectedPath)
      : paths[0];

    const payload = { selectedPath, paths: Array.from(new Set(paths)) };
    this.writeDbProfiles(payload);
    return payload;
  }

  listDbProfiles() {
    const payload = this.ensureDbProfiles();
    return {
      selectedPath: payload.selectedPath,
      currentPath: this.currentDbPath || payload.selectedPath,
      profiles: payload.paths.map((p) => ({
        path: p,
        label: path.basename(p) || p
      }))
    };
  }

  addDbProfile(dbPath) {
    const normalized = this.normalizeDatabasePath(dbPath);
    const payload = this.ensureDbProfiles();
    if (!payload.paths.includes(normalized)) {
      payload.paths.push(normalized);
    }
    payload.selectedPath = normalized;
    this.writeDbProfiles(payload);
    return this.listDbProfiles();
  }

  createEmptyDbProfile(dbPath) {
    const normalized = this.normalizeDatabasePath(dbPath);
    if (fs.existsSync(normalized) && fs.statSync(normalized).size > 0) {
      throw new Error("Database file already exists and is not empty");
    }
    fs.mkdirSync(path.dirname(normalized), { recursive: true });
    const tempDb = new AppDatabase(normalized);
    tempDb.close();
    return this.addDbProfile(normalized);
  }

  switchDatabase(dbPath) {
    if (this.timerRuntimeState.running) {
      throw new Error("Stop active timer before switching database");
    }

    const normalized = this.normalizeDatabasePath(dbPath);
    const payload = this.ensureDbProfiles();
    if (!payload.paths.includes(normalized)) {
      payload.paths.push(normalized);
    }
    payload.selectedPath = normalized;
    this.writeDbProfiles(payload);

    if (this.currentDbPath !== normalized) {
      if (this.db) {
        this.db.updateSettings({
          appSessionRunning: "0",
          appLastExitedAt: new Date().toISOString()
        });
        this.db.close();
      }
      this.db = new AppDatabase(normalized);
      this.currentDbPath = normalized;
      this.db.updateSettings({
        appSessionRunning: "1",
        appLastStartedAt: new Date().toISOString()
      });
    }

    this.startupState = {
      ...(this.startupState || {}),
      dbPath: this.currentDbPath,
      timerRuntime: { ...this.timerRuntimeState }
    };

    return this.listDbProfiles();
  }

  resolveDatabasePath() {
    if (process.env.KANBAN_DB_PATH) {
      return this.normalizeDatabasePath(process.env.KANBAN_DB_PATH);
    }
    return this.ensureDbProfiles().selectedPath;
  }

  persistTimerRuntimeState() {
    if (!this.db) return;
    this.db.updateSettings({
      timerRuntimeRunning: this.timerRuntimeState.running ? "1" : "0",
      timerRuntimeKind: this.timerRuntimeState.kind === "break" ? "break" : "work",
      timerRuntimeTaskId: this.timerRuntimeState.taskId ? String(this.timerRuntimeState.taskId) : "",
      timerRuntimeSessionStartedAt: this.timerRuntimeState.sessionStartedAt || "",
      timerRuntimeRemainingSec: String(Math.max(0, Number(this.timerRuntimeState.remainingSec || 0))),
      timerRuntimePlannedDurationSec: String(Math.max(0, Number(this.timerRuntimeState.plannedDurationSec || 0)))
    });
  }

  setTimerRuntimeState(payload = {}) {
    this.timerRuntimeState = {
      running: Boolean(payload.running),
      kind: payload.kind === "break" ? "break" : "work",
      taskId: Number(payload.taskId || 0) || null,
      sessionStartedAt: payload.sessionStartedAt ? String(payload.sessionStartedAt) : null,
      remainingSec: Math.max(0, Number(payload.remainingSec || 0)),
      plannedDurationSec: Math.max(0, Number(payload.plannedDurationSec || 0))
    };
    this.persistTimerRuntimeState();
  }

  fallbackInterruptActiveTimer() {
    if (!this.db || !this.timerRuntimeState.running) return;
    const now = new Date();
    const startedAt = this.timerRuntimeState.sessionStartedAt || now.toISOString();
    const startedMs = new Date(startedAt).getTime();
    const elapsedSec = Number.isFinite(startedMs)
      ? Math.max(1, Math.round((now.getTime() - startedMs) / 1000))
      : 1;

    try {
      this.db.recordPomodoroSession({
        taskId: this.timerRuntimeState.taskId,
        kind: this.timerRuntimeState.kind,
        durationMinutes: Math.max(1, Math.round(elapsedSec / 60)),
        startedAt,
        endedAt: now.toISOString(),
        wasInterrupted: true
      });
    } catch (_error) {}

    if (this.timerRuntimeState.kind === "work" && this.timerRuntimeState.taskId) {
      try {
        this.db.interruptTask(this.timerRuntimeState.taskId);
      } catch (_error) {}
    }

    this.setTimerRuntimeState({ running: false });
  }

  async invoke(channel, payload = {}) {
    if (!this.db) {
      throw new Error("Backend is not initialized");
    }
    switch (String(channel || "")) {
      case "board:load":
        return this.db.loadBoard(payload || {});
      case "columns:create":
        this.bumpSyncRevision();
        return this.db.createColumn(payload.title);
      case "columns:delete":
        this.bumpSyncRevision();
        return this.db.deleteColumn(payload.columnId);
      case "columns:reorder":
        this.bumpSyncRevision();
        return this.db.reorderColumns(payload.orderedIds);
      case "projects:list":
        return this.db.listProjects();
      case "projects:create":
        this.bumpSyncRevision();
        return this.db.createProject(payload.name);
      case "categories:list":
        return this.db.listCategories();
      case "categories:create":
        this.bumpSyncRevision();
        return this.db.createCategory(payload.name);
      case "tasks:create":
        this.bumpSyncRevision();
        return this.db.createTask(payload);
      case "tasks:update":
        this.bumpSyncRevision();
        return this.db.updateTask(payload.taskId, payload.patch);
      case "tasks:delete":
        this.bumpSyncRevision();
        return this.db.deleteTask(payload.taskId);
      case "tasks:move":
        this.bumpSyncRevision();
        return this.db.moveTask(payload.taskId, payload.toColumnId);
      case "tasks:reorder":
        this.bumpSyncRevision();
        return this.db.reorderTasksInColumn(payload.columnId, payload.orderedTaskIds);
      case "tasks:get":
        return this.db.getTaskById(payload.taskId);
      case "tasks:set-active":
        this.bumpSyncRevision();
        return this.db.setActiveTask(payload.taskId);
      case "tasks:clear-active":
        this.bumpSyncRevision();
        return this.db.clearActiveTask(payload.taskId);
      case "tasks:complete":
        this.bumpSyncRevision();
        return this.db.completeTask(payload.taskId);
      case "tasks:interrupt":
        this.bumpSyncRevision();
        return this.db.interruptTask(payload.taskId);
      case "tasks:increment-spent":
        this.bumpSyncRevision();
        return this.db.incrementTaskSpent(payload.taskId, payload.amount, payload.source || "manual");
      case "backlog:add":
        this.bumpSyncRevision();
        return this.db.addTaskToBacklog(payload.taskId);
      case "backlog:list":
        return this.db.listBacklog(payload.filters || {});
      case "backlog:move":
        this.bumpSyncRevision();
        return this.db.moveTaskFromBacklog(payload.taskId, payload.toColumnId);
      case "todotxt:add":
        this.bumpSyncRevision();
        return this.db.quickAddTodoTxt(payload.line);
      case "pomodoro:record":
        this.bumpSyncRevision();
        return this.db.recordPomodoroSession(payload);
      case "calendar:sessions":
        return this.db.listCalendarSessions({ from: payload.from, to: payload.to });
      case "calendar:scheduled":
        return this.db.listScheduledCalendarEvents({ from: payload.from, to: payload.to });
      case "settings:get":
        return this.db.getSettings();
      case "settings:update":
        this.bumpSyncRevision();
        return this.db.updateSettings(payload.patch);
      case "db:profiles:list":
        return this.listDbProfiles();
      case "db:profiles:choose-path":
        if (!this.chooseDatabasePath) {
          throw new Error("Choosing database path is not available in web mode");
        }
        return this.normalizeDatabasePath(await this.chooseDatabasePath());
      case "db:profiles:add":
        this.bumpSyncRevision();
        return this.addDbProfile(payload.dbPath);
      case "db:profiles:create-empty":
        this.bumpSyncRevision();
        return this.createEmptyDbProfile(payload.dbPath);
      case "db:profiles:select":
        this.bumpSyncRevision();
        return this.switchDatabase(payload.dbPath);
      case "analytics:get":
        return this.db.getAnalytics(payload.filters || {});
      case "archive:list":
        return this.db.listArchive(payload.filters || {});
      case "archive:clone-to-inbox":
        this.bumpSyncRevision();
        return this.db.cloneArchiveTaskToInbox(payload.archiveId);
      case "archive:delete":
        this.bumpSyncRevision();
        return this.db.deleteArchiveTask(payload.archiveId);
      case "sync:get-state":
        return this.getSyncState();
      case "shell:open-external":
        if (this.openExternal) {
          return this.openExternal(String(payload.url || ""));
        }
        return true;
      case "app:startup-state":
        return this.startupState;
      case "timer:state":
        this.setTimerRuntimeState(payload || {});
        return true;
      default:
        throw new Error(`Unknown channel: ${String(channel || "")}`);
    }
  }
}
