import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parseTodoTxt } from "./todotxt.js";

const MANDATORY_COLUMNS = ["Inbox", "Organise", "Wait", "Process", "Done"];
const LEGACY_COLUMN_RENAMES = {
  Plan: "Organise",
  Project: "Organise"
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeIsoDateTime(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const localDate = new Date(year, month, day, 0, 0, 0, 0);
    if (!Number.isFinite(localDate.getTime())) return null;
    return localDate.toISOString();
  }
  const parsedMs = new Date(raw).getTime();
  if (!Number.isFinite(parsedMs)) return null;
  return new Date(parsedMs).toISOString();
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class AppDatabase {
  constructor(dbFilePath) {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

    this.db = new Database(dbFilePath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");

    this.initSchema();
    this.seedDefaults();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        position INTEGER NOT NULL,
        system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL DEFAULT '',
        result TEXT NOT NULL DEFAULT '',
        description_md TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#7dd3fc',
        priority TEXT,
        scheduled_at TEXT,
        start_date TEXT,
        end_date TEXT,
        planned_pomodoros INTEGER NOT NULL DEFAULT 0,
        spent_pomodoros INTEGER NOT NULL DEFAULT 0,
        pomodoro_work_minutes INTEGER NOT NULL DEFAULT 0,
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 0,
        column_id INTEGER NOT NULL,
        project_id INTEGER,
        category_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS task_attributes (
        task_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (task_id, key),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_categories (
        task_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, category_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        from_column_id INTEGER,
        to_column_id INTEGER NOT NULL,
        moved_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (from_column_id) REFERENCES columns(id) ON DELETE SET NULL,
        FOREIGN KEY (to_column_id) REFERENCES columns(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pomodoro_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        kind TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        was_interrupted INTEGER NOT NULL DEFAULT 0,
        task_snapshot TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        amount INTEGER NOT NULL DEFAULT 1,
        event_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'pomodoro',
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS archive_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL UNIQUE,
        subject TEXT NOT NULL DEFAULT '',
        result TEXT NOT NULL DEFAULT '',
        description_md TEXT NOT NULL,
        color TEXT NOT NULL,
        priority TEXT,
        scheduled_at TEXT,
        start_date TEXT,
        end_date TEXT,
        planned_pomodoros INTEGER NOT NULL DEFAULT 0,
        spent_pomodoros INTEGER NOT NULL DEFAULT 0,
        project_name TEXT,
        category_name TEXT,
        completed_at TEXT NOT NULL,
        archived_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backlog_tasks (
        task_id INTEGER PRIMARY KEY,
        added_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    this.ensureSchemaColumns();
  }

  ensureSchemaColumns() {
    this.addColumnIfMissing("tasks", "subject", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("archive_tasks", "subject", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("tasks", "result", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("archive_tasks", "result", "TEXT NOT NULL DEFAULT ''");
    this.addColumnIfMissing("tasks", "scheduled_at", "TEXT");
    this.addColumnIfMissing("archive_tasks", "scheduled_at", "TEXT");
    this.addColumnIfMissing("tasks", "pomodoro_work_minutes", "INTEGER NOT NULL DEFAULT 0");
    this.addColumnIfMissing("pomodoro_sessions", "task_snapshot", "TEXT");
    this.ensureTaskCategoryLinks();
  }

  hasColumn(tableName, columnName) {
    const table = String(tableName || "");
    const column = String(columnName || "");
    if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(table) || !/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(column)) {
      throw new Error("Invalid schema identifiers");
    }
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some((row) => String(row.name) === column);
  }

  addColumnIfMissing(tableName, columnName, columnSpec) {
    if (this.hasColumn(tableName, columnName)) return;
    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSpec}`);
  }


  ensureTaskCategoryLinks() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_categories (
        task_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (task_id, category_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`
      INSERT OR IGNORE INTO task_categories (task_id, category_id)
      SELECT id, category_id
      FROM tasks
      WHERE category_id IS NOT NULL;
    `);
  }

  seedDefaults() {
    this.migrateLegacyColumns();
    this.ensureMandatoryColumns();

    const defaultSettings = {
      workMinutes: "25",
      shortBreakMinutes: "5",
      longBreakMinutes: "30",
      workdayStart: "09:00",
      workdayEnd: "18:00",
      kanbanProcessView: "today",
      theme: "light",
      language: "ru",
      timerTickingEnabled: "0",
      markdownExtendedEnabled: "1",
      clientAutoRefreshEnabled: "1",
      clientAutoRefreshIntervalSec: "3"
    };

    const upsertSetting = this.db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`
    );

    for (const [key, value] of Object.entries(defaultSettings)) {
      upsertSetting.run(key, value);
    }
  }

  migrateLegacyColumns() {
    const tx = this.db.transaction(() => {
      for (const [fromTitle, toTitle] of Object.entries(LEGACY_COLUMN_RENAMES)) {
        const legacyColumn = this.db.prepare("SELECT id FROM columns WHERE title = ?").get(fromTitle);
        if (!legacyColumn) continue;

        const targetColumn = this.db.prepare("SELECT id FROM columns WHERE title = ?").get(toTitle);
        if (!targetColumn) {
          this.db
            .prepare("UPDATE columns SET title = ?, system = 1 WHERE id = ?")
            .run(toTitle, legacyColumn.id);
          continue;
        }

        this.db
          .prepare("UPDATE tasks SET column_id = ? WHERE column_id = ?")
          .run(targetColumn.id, legacyColumn.id);
        this.db
          .prepare("UPDATE task_moves SET to_column_id = ? WHERE to_column_id = ?")
          .run(targetColumn.id, legacyColumn.id);
        this.db
          .prepare("UPDATE task_moves SET from_column_id = ? WHERE from_column_id = ?")
          .run(targetColumn.id, legacyColumn.id);
        this.db.prepare("DELETE FROM columns WHERE id = ?").run(legacyColumn.id);
      }
    });

    tx();
  }

  ensureMandatoryColumns() {
    const existingColumns = this.db
      .prepare("SELECT id, title, position FROM columns ORDER BY position, id")
      .all();

    const existingByTitle = new Map(existingColumns.map((column) => [column.title, column]));
    const insertColumn = this.db.prepare(
      "INSERT INTO columns (title, position, system) VALUES (?, ?, 1)"
    );
    const setSystemMandatory = this.db.prepare("UPDATE columns SET system = 1 WHERE id = ?");

    const tx = this.db.transaction(() => {
      const maxPosition = existingColumns.reduce(
        (max, column) => Math.max(max, Number(column.position) || 0),
        -1
      );
      let nextPosition = maxPosition + 1;

      for (const title of MANDATORY_COLUMNS) {
        const existing = existingByTitle.get(title);
        if (existing) {
          setSystemMandatory.run(existing.id);
        } else {
          const inserted = insertColumn.run(title, nextPosition++);
          existingByTitle.set(title, { id: inserted.lastInsertRowid, title });
        }
      }
    });

    tx();
  }

  close() {
    this.db.close();
  }

  getSettings() {
    const rows = this.db.prepare("SELECT key, value FROM settings").all();
    const out = {};
    for (const row of rows) {
      out[row.key] = row.value;
    }
    return out;
  }

  updateSettings(patch) {
    const upsert = this.db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );

    const tx = this.db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });

    tx(Object.entries(patch || {}));
    return this.getSettings();
  }

  getMandatoryColumns() {
    return this.db.prepare("SELECT id, title FROM columns WHERE system = 1 ORDER BY position").all();
  }

  getInboxColumnId() {
    const inbox = this.db.prepare("SELECT id FROM columns WHERE title = 'Inbox' LIMIT 1").get();
    return inbox?.id;
  }

  getDoneColumnId() {
    const done = this.db.prepare("SELECT id FROM columns WHERE title = 'Done' LIMIT 1").get();
    return done?.id;
  }

  createColumn(title) {
    const normalized = (title || "").trim();
    if (!normalized) {
      throw new Error("Column title is required");
    }

    const exists = this.db.prepare("SELECT id FROM columns WHERE title = ?").get(normalized);
    if (exists) {
      throw new Error("Column with this name already exists");
    }

    const position =
      this.db.prepare("SELECT COALESCE(MAX(position), -1) + 1 as position FROM columns").get().position;

    const result = this.db
      .prepare("INSERT INTO columns (title, position, system) VALUES (?, ?, 0)")
      .run(normalized, position);

    return this.db.prepare("SELECT * FROM columns WHERE id = ?").get(result.lastInsertRowid);
  }

  deleteColumn(columnId) {
    const id = toInt(columnId, 0);
    const column = this.db.prepare("SELECT * FROM columns WHERE id = ?").get(id);
    if (!column) {
      throw new Error("Column not found");
    }
    if (column.system) {
      throw new Error("Mandatory columns cannot be deleted");
    }

    const inboxId = this.getInboxColumnId();
    if (!inboxId) {
      throw new Error("Inbox column is missing");
    }

    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE tasks SET column_id = ? WHERE column_id = ?").run(inboxId, id);
      this.db.prepare("DELETE FROM columns WHERE id = ?").run(id);
      this.rebuildColumnPositions();
    });

    tx();
    return true;
  }

  rebuildColumnPositions() {
    const rows = this.db.prepare("SELECT id FROM columns ORDER BY position, id").all();
    const update = this.db.prepare("UPDATE columns SET position = ? WHERE id = ?");
    rows.forEach((row, idx) => update.run(idx, row.id));
  }

  reorderColumns(orderedIds) {
    if (!Array.isArray(orderedIds)) return;
    const update = this.db.prepare("UPDATE columns SET position = ? WHERE id = ?");
    const tx = this.db.transaction((ids) => {
      ids.forEach((id, idx) => {
        update.run(idx, toInt(id, 0));
      });
      this.rebuildColumnPositions();
    });
    tx(orderedIds);
  }

  ensureProject(nameOrId) {
    if (nameOrId === null || nameOrId === undefined || nameOrId === "") {
      return null;
    }

    if (Number.isInteger(nameOrId) || /^\d+$/.test(String(nameOrId))) {
      const id = toInt(nameOrId, 0);
      const row = this.db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
      return row?.id || null;
    }

    const name = String(nameOrId).trim();
    if (!name) return null;

    const existing = this.db.prepare("SELECT id FROM projects WHERE name = ?").get(name);
    if (existing) return existing.id;

    return this.db.prepare("INSERT INTO projects (name) VALUES (?)").run(name).lastInsertRowid;
  }

  ensureCategory(nameOrId) {
    if (nameOrId === null || nameOrId === undefined || nameOrId === "") {
      return null;
    }

    if (Number.isInteger(nameOrId) || /^\d+$/.test(String(nameOrId))) {
      const id = toInt(nameOrId, 0);
      const row = this.db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
      return row?.id || null;
    }

    const name = String(nameOrId).trim();
    if (!name) return null;

    const existing = this.db.prepare("SELECT id FROM categories WHERE name = ?").get(name);
    if (existing) return existing.id;

    return this.db.prepare("INSERT INTO categories (name) VALUES (?)").run(name).lastInsertRowid;
  }

  createProject(name) {
    const normalized = (name || "").trim();
    if (!normalized) throw new Error("Project name is required");

    const existing = this.db.prepare("SELECT * FROM projects WHERE name = ?").get(normalized);
    if (existing) return existing;

    const id = this.db.prepare("INSERT INTO projects (name) VALUES (?)").run(normalized).lastInsertRowid;
    return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  }

  createCategory(name) {
    const normalized = (name || "").trim();
    if (!normalized) throw new Error("Category name is required");

    const existing = this.db.prepare("SELECT * FROM categories WHERE name = ?").get(normalized);
    if (existing) return existing;

    const id = this.db.prepare("INSERT INTO categories (name) VALUES (?)").run(normalized).lastInsertRowid;
    return this.db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
  }

  listProjects() {
    return this.db.prepare("SELECT * FROM projects ORDER BY name").all();
  }

  listCategories() {
    return this.db.prepare("SELECT * FROM categories ORDER BY name").all();
  }

  normalizeAttributes(attributes) {
    if (!attributes || typeof attributes !== "object") return {};
    const out = {};
    for (const [key, value] of Object.entries(attributes)) {
      const k = String(key).trim();
      const v = String(value ?? "").trim();
      if (k && v) {
        out[k] = v;
      }
    }
    return out;
  }

  upsertTaskAttributes(taskId, attributes) {
    const normalized = this.normalizeAttributes(attributes);
    const task = toInt(taskId, 0);

    const deleteAll = this.db.prepare("DELETE FROM task_attributes WHERE task_id = ?");
    const insert = this.db.prepare(
      "INSERT INTO task_attributes (task_id, key, value) VALUES (?, ?, ?)"
    );

    deleteAll.run(task);
    for (const [key, value] of Object.entries(normalized)) {
      insert.run(task, key, value);
    }
  }

  normalizeCategoryIds(rawIds = []) {
    const out = [];
    for (const raw of Array.isArray(rawIds) ? rawIds : []) {
      const id = this.ensureCategory(raw);
      if (!id || out.includes(id)) continue;
      out.push(id);
    }
    return out;
  }

  syncTaskCategories(taskId, rawCategoryIds = [], fallbackCategory = null) {
    const task = toInt(taskId, 0);
    let categoryIds = this.normalizeCategoryIds(rawCategoryIds);

    if (!categoryIds.length && fallbackCategory !== null && fallbackCategory !== undefined && fallbackCategory !== "") {
      const fallbackId = this.ensureCategory(fallbackCategory);
      if (fallbackId) categoryIds = [fallbackId];
    }

    const deleteLinks = this.db.prepare("DELETE FROM task_categories WHERE task_id = ?");
    const insertLink = this.db.prepare(
      "INSERT OR IGNORE INTO task_categories (task_id, category_id) VALUES (?, ?)"
    );

    deleteLinks.run(task);
    for (const categoryId of categoryIds) {
      insertLink.run(task, categoryId);
    }

    const primaryCategoryId = categoryIds.length ? categoryIds[0] : null;
    this.db.prepare("UPDATE tasks SET category_id = ? WHERE id = ?").run(primaryCategoryId, task);
    return categoryIds;
  }

  attachCategoriesToTasks(rows = []) {
    const taskRows = Array.isArray(rows) ? rows : [];
    if (!taskRows.length) return taskRows;

    const taskIds = Array.from(new Set(taskRows.map((row) => toInt(row.id, 0)).filter(Boolean)));
    if (!taskIds.length) return taskRows;

    const placeholders = taskIds.map(() => "?").join(",");
    const links = this.db
      .prepare(
        `SELECT tc.task_id, tc.category_id, c.name AS category_name
         FROM task_categories tc
         JOIN categories c ON c.id = tc.category_id
         WHERE tc.task_id IN (${placeholders})
         ORDER BY c.name`
      )
      .all(...taskIds);

    const byTask = new Map();
    for (const link of links) {
      if (!byTask.has(link.task_id)) {
        byTask.set(link.task_id, []);
      }
      byTask.get(link.task_id).push({ id: link.category_id, name: link.category_name });
    }

    for (const row of taskRows) {
      const items = byTask.get(row.id) || [];
      const ids = items.map((x) => x.id);
      const names = items.map((x) => x.name);
      row.category_ids = ids;
      row.category_names = names;
      row.category_name = names.join(", ") || row.category_name || "";
      row.category_id = ids[0] || row.category_id || null;
    }

    return taskRows;
  }

  nextTaskOrder(columnId) {
    return this.db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as nextOrder FROM tasks WHERE column_id = ?")
      .get(toInt(columnId, 0)).nextOrder;
  }

  getWorkPomodoroDurationMs() {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'workMinutes'").get();
    const minutes = Number.parseInt(String(row?.value || "25"), 10);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 25;
    return safeMinutes * 60 * 1000;
  }

  resolveScheduledAt(scheduledAt, excludeTaskId = 0) {
    const raw = String(scheduledAt || "").trim();
    if (!raw) return null;

    const parsedMs = new Date(raw).getTime();
    if (!Number.isFinite(parsedMs)) return null;

    const durationMs = this.getWorkPomodoroDurationMs();
    let candidateStart = parsedMs;
    const excludeId = toInt(excludeTaskId, 0);

    const rows = this.db
      .prepare(
        `SELECT id, scheduled_at
         FROM tasks
         WHERE scheduled_at IS NOT NULL
           AND is_completed = 0
           AND (? = 0 OR id <> ?)
         ORDER BY scheduled_at`
      )
      .all(excludeId, excludeId);

    for (let pass = 0; pass < 512; pass += 1) {
      let shifted = false;
      const candidateEnd = candidateStart + durationMs;

      for (const row of rows) {
        const rowStart = new Date(row.scheduled_at).getTime();
        if (!Number.isFinite(rowStart)) continue;
        const rowEnd = rowStart + durationMs;

        if (rowStart < candidateEnd && rowEnd > candidateStart) {
          candidateStart = rowEnd;
          shifted = true;
        }
      }

      if (!shifted) break;
    }

    return new Date(candidateStart).toISOString();
  }

  createTask(payload) {
    const descriptionMd = String(payload?.descriptionMd || "").trim();
    if (!descriptionMd) {
      throw new Error("Task description is required");
    }

    const inboxId = this.getInboxColumnId();
    const columnId = toInt(payload?.columnId, inboxId);
    const projectId = this.ensureProject(payload?.projectId ?? payload?.projectName);
    const fallbackCategory = payload?.categoryId ?? payload?.categoryName ?? null;
    const categoryIds = this.normalizeCategoryIds(payload?.categoryIds || []);
    const categoryId = categoryIds[0] || this.ensureCategory(fallbackCategory);

    const sortOrder = this.nextTaskOrder(columnId);

    const plannedPomodoros =
      payload?.plannedPomodoros === undefined || payload?.plannedPomodoros === null || payload?.plannedPomodoros === ""
        ? 1
        : toInt(payload?.plannedPomodoros, 1);

    const result = this.db
      .prepare(
        `INSERT INTO tasks (
          subject, result, description_md, color, priority, scheduled_at, start_date, end_date, planned_pomodoros,
          spent_pomodoros, is_completed, is_active, column_id, project_id, category_id,
          sort_order, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(payload?.subject || "").trim(),
        String(payload?.result || "").trim(),
        descriptionMd,
        payload?.color || "#7dd3fc",
        payload?.priority || null,
        payload?.ignoreScheduleOverlap ? (payload?.scheduledAt || null) : this.resolveScheduledAt(payload?.scheduledAt || null),
        normalizeIsoDateTime(payload?.startDate),
        normalizeIsoDateTime(payload?.endDate),
        plannedPomodoros,
        toInt(payload?.spentPomodoros, 0),
        payload?.isCompleted ? 1 : 0,
        payload?.isActive ? 1 : 0,
        columnId,
        projectId,
        categoryId,
        sortOrder,
        payload?.isCompleted ? nowIso() : null
      );

    const taskId = result.lastInsertRowid;
    this.syncTaskCategories(taskId, categoryIds, fallbackCategory);
    this.upsertTaskAttributes(taskId, payload?.attributes || {});

    if (payload?.isCompleted) {
      this.upsertArchiveTask(taskId);
    }

    return this.getTaskById(taskId);
  }

  updateTask(taskId, patch) {
    const id = toInt(taskId, 0);
    const current = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!current) {
      throw new Error("Task not found");
    }

    const updates = [];
    const values = [];

    const append = (column, value) => {
      updates.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.subject !== undefined) append("subject", String(patch.subject || "").trim());
    if (patch.result !== undefined) append("result", String(patch.result || "").trim());
    if (patch.descriptionMd !== undefined) append("description_md", String(patch.descriptionMd).trim());
    if (patch.color !== undefined) append("color", patch.color || "#7dd3fc");
    if (patch.priority !== undefined) append("priority", patch.priority || null);
    if (patch.scheduledAt !== undefined) {
      const scheduledAt = patch.ignoreScheduleOverlap
        ? (patch.scheduledAt || null)
        : this.resolveScheduledAt(patch.scheduledAt || null, id);
      append("scheduled_at", scheduledAt);
    }
    if (patch.startDate !== undefined) append("start_date", normalizeIsoDateTime(patch.startDate));
    if (patch.endDate !== undefined) append("end_date", normalizeIsoDateTime(patch.endDate));
    if (patch.plannedPomodoros !== undefined)
      append("planned_pomodoros", toInt(patch.plannedPomodoros, 0));
    if (patch.spentPomodoros !== undefined)
      append("spent_pomodoros", toInt(patch.spentPomodoros, current.spent_pomodoros));

    if (patch.projectId !== undefined || patch.projectName !== undefined) {
      append("project_id", this.ensureProject(patch.projectId ?? patch.projectName));
    }

    const hasCategoryPatch =
      patch.categoryIds !== undefined || patch.categoryId !== undefined || patch.categoryName !== undefined;

    if (patch.columnId !== undefined) {
      const columnId = toInt(patch.columnId, current.column_id);
      append("column_id", columnId);
      append("sort_order", this.nextTaskOrder(columnId));
    }

    if (patch.isCompleted !== undefined) {
      const isCompleted = !!patch.isCompleted;
      append("is_completed", isCompleted ? 1 : 0);
      append("completed_at", isCompleted ? nowIso() : null);
      if (isCompleted) {
        append("is_active", 0);
        const doneId = this.getDoneColumnId();
        if (doneId) {
          append("column_id", doneId);
          append("sort_order", this.nextTaskOrder(doneId));
        }
      }
    }

    const tx = this.db.transaction(() => {
      if (updates.length) {
        values.push(id);
        this.db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);
      }

      if (patch.attributes !== undefined) {
        this.upsertTaskAttributes(id, patch.attributes);
      }

      if (hasCategoryPatch) {
        const fallbackCategory = patch.categoryId ?? patch.categoryName ?? null;
        this.syncTaskCategories(id, patch.categoryIds || [], fallbackCategory);
      }

      if (patch.isCompleted) {
        this.db.prepare("DELETE FROM backlog_tasks WHERE task_id = ?").run(id);
      }
    });

    tx();

    const updated = this.getTaskById(id);
    if (updated?.is_completed) {
      this.upsertArchiveTask(id, updated.completed_at || nowIso());
    } else {
      this.deleteArchiveTaskByTaskId(id);
    }

    return updated;
  }

  deleteTask(taskId) {
    const id = toInt(taskId, 0);
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM archive_tasks WHERE task_id = ?").run(id);
      this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    });
    tx();
    return true;
  }

  moveTask(taskId, toColumnId) {
    const id = toInt(taskId, 0);
    const targetColumnId = toInt(toColumnId, 0);

    const task = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!task) throw new Error("Task not found");

    const targetColumn = this.db.prepare("SELECT id FROM columns WHERE id = ?").get(targetColumnId);
    if (!targetColumn) throw new Error("Target column not found");

    const targetOrder = this.nextTaskOrder(targetColumnId);

    const tx = this.db.transaction(() => {
      this.db
        .prepare("UPDATE tasks SET column_id = ?, sort_order = ? WHERE id = ?")
        .run(targetColumnId, targetOrder, id);

      this.db
        .prepare(
          "INSERT INTO task_moves (task_id, from_column_id, to_column_id, moved_at) VALUES (?, ?, ?, ?)"
        )
        .run(id, task.column_id, targetColumnId, nowIso());
    });

    tx();
    return this.getTaskById(id);
  }

  reorderTasksInColumn(columnId, orderedTaskIds) {
    const colId = toInt(columnId, 0);
    const column = this.db.prepare("SELECT id FROM columns WHERE id = ?").get(colId);
    if (!column) throw new Error("Column not found");

    const current = this.db
      .prepare("SELECT id FROM tasks WHERE column_id = ? ORDER BY sort_order, id")
      .all(colId)
      .map((x) => x.id);
    const currentSet = new Set(current);

    const normalized = [];
    for (const rawId of Array.isArray(orderedTaskIds) ? orderedTaskIds : []) {
      const id = toInt(rawId, 0);
      if (!id || !currentSet.has(id) || normalized.includes(id)) continue;
      normalized.push(id);
    }

    const rest = current.filter((id) => !normalized.includes(id));
    const finalOrder = [...normalized, ...rest];

    const update = this.db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ? AND column_id = ?");
    const tx = this.db.transaction(() => {
      finalOrder.forEach((taskId, idx) => {
        update.run(idx, taskId, colId);
      });
    });
    tx();
    return true;
  }

  setActiveTask(taskId) {
    const id = toInt(taskId, 0);
    const task = this.db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) throw new Error("Task not found");

    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE tasks SET is_active = 0").run();
      this.db.prepare("UPDATE tasks SET is_active = 1 WHERE id = ?").run(id);
    });

    tx();
    return this.getTaskById(id);
  }

  clearActiveTask(taskId = null) {
    if (taskId) {
      this.db.prepare("UPDATE tasks SET is_active = 0 WHERE id = ?").run(toInt(taskId, 0));
    } else {
      this.db.prepare("UPDATE tasks SET is_active = 0").run();
    }
    return true;
  }

  upsertArchiveTask(taskId, completedAtOverride = null) {
    const id = toInt(taskId, 0);
    const row = this.getTaskById(id);

    if (!row || !row.is_completed) {
      return false;
    }

    const completedAt = completedAtOverride || row.completed_at || nowIso();

    this.db
      .prepare(
        `INSERT INTO archive_tasks (
           task_id, subject, result, description_md, color, priority, scheduled_at, start_date, end_date,
           planned_pomodoros, spent_pomodoros, project_name, category_name, completed_at, archived_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(task_id) DO UPDATE SET
           subject = excluded.subject,
           result = excluded.result,
           description_md = excluded.description_md,
           color = excluded.color,
           priority = excluded.priority,
           scheduled_at = excluded.scheduled_at,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           planned_pomodoros = excluded.planned_pomodoros,
           spent_pomodoros = excluded.spent_pomodoros,
           project_name = excluded.project_name,
           category_name = excluded.category_name,
           completed_at = excluded.completed_at,
           archived_at = excluded.archived_at`
      )
      .run(
        row.id,
        row.subject || "",
        row.result || "",
        row.description_md,
        row.color,
        row.priority,
        row.scheduled_at,
        row.start_date,
        row.end_date,
        row.planned_pomodoros,
        row.spent_pomodoros,
        row.project_name,
        row.category_name || "",
        completedAt,
        nowIso()
      );

    return true;
  }

  deleteArchiveTaskByTaskId(taskId) {
    const id = toInt(taskId, 0);
    this.db.prepare("DELETE FROM archive_tasks WHERE task_id = ?").run(id);
    return true;
  }

  completeTask(taskId) {
    const id = toInt(taskId, 0);
    const doneId = this.getDoneColumnId();
    const completedAt = nowIso();

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM backlog_tasks WHERE task_id = ?").run(id);
      this.db
        .prepare(
          `UPDATE tasks
           SET is_completed = 1,
               is_active = 0,
               completed_at = ?,
               column_id = COALESCE(?, column_id),
               sort_order = CASE WHEN ? IS NULL THEN sort_order ELSE ? END
           WHERE id = ?`
        )
        .run(completedAt, doneId, doneId, doneId ? this.nextTaskOrder(doneId) : null, id);

      this.upsertArchiveTask(id, completedAt);
    });

    tx();
    return this.getTaskById(id);
  }

  interruptTask(taskId) {
    const id = toInt(taskId, 0);
    this.db.prepare("UPDATE tasks SET is_active = 0 WHERE id = ?").run(id);
    return this.getTaskById(id);
  }

  incrementTaskSpent(taskId, amount = 1, source = "manual") {
    const id = toInt(taskId, 0);
    const inc = Math.max(1, toInt(amount, 1));
    const eventAt = nowIso();

    const tx = this.db.transaction(() => {
      const task = this.db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
      if (!task) {
        throw new Error("Task not found");
      }
      this.db
        .prepare("UPDATE tasks SET spent_pomodoros = spent_pomodoros + ? WHERE id = ?")
        .run(inc, id);
      this.db
        .prepare("INSERT INTO spent_events (task_id, amount, event_at, source) VALUES (?, ?, ?, ?)")
        .run(id, inc, eventAt, source);
    });

    tx();
    return this.getTaskById(id);
  }

  getTaskById(taskId) {
    const id = toInt(taskId, 0);
    const row = this.db
      .prepare(
        `SELECT t.*, p.name as project_name, c.name as category_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.id = ?`
      )
      .get(id);

    if (!row) return null;

    const attrs = this.db
      .prepare("SELECT key, value FROM task_attributes WHERE task_id = ? ORDER BY key")
      .all(id);

    row.attributes = Object.fromEntries(attrs.map((a) => [a.key, a.value]));
    this.attachCategoriesToTasks([row]);
    return row;
  }

  getActiveTask() {
    const row = this.db
      .prepare(
        `SELECT t.*, p.name as project_name, c.name as category_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.is_active = 1
         ORDER BY t.id DESC
         LIMIT 1`
      )
      .get();
    if (!row) return null;
    this.attachCategoriesToTasks([row]);
    return row;
  }

  buildTaskFilter(filters = {}, alias = "t") {
    const where = [];
    const values = [];

    if (filters.descriptionFragment) {
      where.push(`${alias}.description_md LIKE ?`);
      values.push(`%${String(filters.descriptionFragment).trim()}%`);
    }

    if (filters.projectId) {
      where.push(`${alias}.project_id = ?`);
      values.push(toInt(filters.projectId, 0));
    }

    const categoryIds = Array.isArray(filters.categoryIds)
      ? filters.categoryIds.map((x) => toInt(x, 0)).filter((x) => x > 0)
      : (filters.categoryId ? [toInt(filters.categoryId, 0)] : []);

    if (categoryIds.length) {
      const placeholders = categoryIds.map(() => "?").join(",");
      where.push(
        `EXISTS (
           SELECT 1 FROM task_categories tc
           WHERE tc.task_id = ${alias}.id
             AND tc.category_id IN (${placeholders})
         )`
      );
      values.push(...categoryIds);
    }

    if (filters.priority) {
      where.push(`${alias}.priority = ?`);
      values.push(String(filters.priority));
    }

    if (filters.startDateFrom) {
      where.push(`${alias}.start_date >= ?`);
      values.push(filters.startDateFrom);
    }

    if (filters.attributeKey || filters.attributeValue) {
      const attrKey = String(filters.attributeKey || "").trim();
      const attrValue = String(filters.attributeValue || "").trim();

      if (attrKey && attrValue) {
        where.push(
          `EXISTS (
             SELECT 1 FROM task_attributes ta
             WHERE ta.task_id = ${alias}.id
               AND ta.key LIKE ?
               AND ta.value LIKE ?
           )`
        );
        values.push(`%${attrKey}%`, `%${attrValue}%`);
      } else if (attrKey) {
        where.push(
          `EXISTS (
             SELECT 1 FROM task_attributes ta
             WHERE ta.task_id = ${alias}.id
               AND ta.key LIKE ?
           )`
        );
        values.push(`%${attrKey}%`);
      } else if (attrValue) {
        where.push(
          `EXISTS (
             SELECT 1 FROM task_attributes ta
             WHERE ta.task_id = ${alias}.id
               AND ta.value LIKE ?
           )`
        );
        values.push(`%${attrValue}%`);
      }
    }

    return {
      whereClause: where.length ? `WHERE ${where.join(" AND ")}` : "",
      values
    };
  }

  loadBoard(filters = {}) {
    const columns = this.db.prepare("SELECT * FROM columns ORDER BY position, id").all();
    const { whereClause, values } = this.buildTaskFilter(filters, "t");
    const whereWithoutKeyword = whereClause ? whereClause.replace(/^WHERE\s+/i, "") : "";
    const boardWhere = [
      "NOT EXISTS (SELECT 1 FROM backlog_tasks bl WHERE bl.task_id = t.id)",
      whereWithoutKeyword
    ]
      .filter(Boolean)
      .join(" AND ");
    const boardWhereClause = boardWhere ? `WHERE ${boardWhere}` : "";

    const taskRows = this.db
      .prepare(
        `SELECT t.*, p.name as project_name, c.name as category_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         ${boardWhereClause}
         ORDER BY t.column_id, t.sort_order, t.id`
      )
      .all(...values);

    const taskIds = taskRows.map((x) => x.id);
    const attributesByTask = {};

    if (taskIds.length) {
      const placeholders = taskIds.map(() => "?").join(",");
      const attrs = this.db
        .prepare(
          `SELECT task_id, key, value FROM task_attributes
           WHERE task_id IN (${placeholders})
           ORDER BY key`
        )
        .all(...taskIds);

      for (const attr of attrs) {
        if (!attributesByTask[attr.task_id]) {
          attributesByTask[attr.task_id] = {};
        }
        attributesByTask[attr.task_id][attr.key] = attr.value;
      }
    }

    this.attachCategoriesToTasks(taskRows);

    const byColumn = new Map(columns.map((c) => [c.id, { ...c, tasks: [] }]));

    for (const task of taskRows) {
      task.attributes = attributesByTask[task.id] || {};
      if (!byColumn.has(task.column_id)) {
        byColumn.set(task.column_id, { id: task.column_id, title: "Unknown", tasks: [] });
      }
      byColumn.get(task.column_id).tasks.push(task);
    }

    return {
      columns: Array.from(byColumn.values()).sort((a, b) => a.position - b.position),
      projects: this.listProjects(),
      categories: this.listCategories(),
      settings: this.getSettings(),
      activeTask: this.getActiveTask()
    };
  }

  parseAttributesText(text) {
    const out = {};
    const lines = String(text || "")
      .split(/\n|,/) 
      .map((x) => x.trim())
      .filter(Boolean);

    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) {
        out[key] = value;
      }
    }

    return out;
  }

  quickAddTodoTxt(line) {
    const parsed = parseTodoTxt(line);

    const projectName = parsed.projects[0] || null;
    const categoryName = parsed.contexts[0] || null;

    const inboxId = this.getInboxColumnId();

    const normalizedKeyValues = Object.fromEntries(
      Object.entries(parsed.keyValues || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );
    const scheduledRaw = normalizedKeyValues.skd || normalizedKeyValues.scheduled || null;
    const normalizedScheduled = scheduledRaw ? String(scheduledRaw).trim() : null;

    const attributes = { source: "todotxt" };
    for (const [key, value] of Object.entries(parsed.keyValues || {})) {
      const keyLower = String(key).toLowerCase();
      if (keyLower === "skd" || keyLower === "scheduled") continue;
      attributes[key] = value;
    }

    const task = this.createTask({
      descriptionMd: parsed.description,
      columnId: inboxId,
      color: "#86efac",
      priority: parsed.priority,
      scheduledAt: normalizedScheduled,
      startDate: parsed.creationDate,
      endDate: parsed.completionDate,
      isCompleted: parsed.isCompleted,
      projectName,
      categoryName,
      attributes
    });

    return {
      task,
      parsed
    };
  }

  recordPomodoroSession(payload) {
    const rawTaskId = payload?.taskId ? toInt(payload.taskId, null) : null;
    const kind = payload?.kind || "work";
    const durationMinutes = Math.max(1, toInt(payload?.durationMinutes, 25));
    const startedAt = payload?.startedAt || nowIso();
    const endedAt = payload?.endedAt || nowIso();
    const wasInterrupted = payload?.wasInterrupted ? 1 : 0;

    const taskRow = rawTaskId
      ? this.db.prepare("SELECT id, description_md FROM tasks WHERE id = ?").get(rawTaskId)
      : null;
    const taskId = taskRow?.id || null;
    const taskSnapshot = String(payload?.taskSnapshot || taskRow?.description_md || "").trim() || null;

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO pomodoro_sessions (
             task_id, kind, duration_minutes, started_at, ended_at, was_interrupted, task_snapshot
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(taskId, kind, durationMinutes, startedAt, endedAt, wasInterrupted, taskSnapshot);

      if (taskId && kind === "work") {
        this.db
          .prepare("UPDATE tasks SET pomodoro_work_minutes = pomodoro_work_minutes + ? WHERE id = ?")
          .run(durationMinutes, taskId);
      }

      if (taskId && kind === "work" && !wasInterrupted) {
        this.incrementTaskSpent(taskId, 1, "pomodoro");
      }

      return result.lastInsertRowid;
    });

    const sessionId = tx();
    return this.db.prepare("SELECT * FROM pomodoro_sessions WHERE id = ?").get(sessionId);
  }

  listCalendarSessions({ from, to } = {}) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      throw new Error("Invalid calendar range");
    }

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    return this.db
      .prepare(
        `SELECT
           ps.id,
           ps.task_id,
           ps.kind,
           ps.duration_minutes,
           ps.started_at,
           ps.ended_at,
           ps.was_interrupted,
           ps.task_snapshot,
           t.project_id,
           t.category_id,
           p.name AS project_name,
           c.name AS category_name
         FROM pomodoro_sessions ps
         LEFT JOIN tasks t ON t.id = ps.task_id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE ps.kind = 'work'
           AND ps.started_at < ?
           AND ps.ended_at >= ?
         ORDER BY ps.started_at`
      )
      .all(toIso, fromIso);
  }
  listScheduledCalendarEvents({ from, to } = {}) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      throw new Error("Invalid calendar range");
    }

    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();

    return this.db
      .prepare(
        `SELECT
           t.id AS task_id,
           t.subject,
           t.result,
           t.description_md,
           t.scheduled_at,
           t.is_completed,
           t.completed_at,
           t.priority,
           t.planned_pomodoros,
           t.column_id,
           p.name AS project_name,
           COALESCE(GROUP_CONCAT(c.name, ', '), '') AS category_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN task_categories tc ON tc.task_id = t.id
         LEFT JOIN categories c ON c.id = tc.category_id
         WHERE t.scheduled_at IS NOT NULL
           AND t.scheduled_at >= ?
           AND t.scheduled_at < ?
         GROUP BY t.id
         ORDER BY t.scheduled_at`
      )
      .all(fromIso, toIso);
  }

  getAnalytics(filters = {}) {
    const { whereClause, values } = this.buildTaskFilter(filters, "t");

    const tasks = this.db
      .prepare(
        `SELECT t.*, p.name as project_name, c.name as category_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         ${whereClause}
         ORDER BY t.created_at`
      )
      .all(...values);

    this.attachCategoriesToTasks(tasks);

    const sessionWhere = [];
    const sessionValues = [];
    const sessionTaskFilters = [];

    if (filters.projectId) {
      sessionTaskFilters.push("tx.project_id = ?");
      sessionValues.push(toInt(filters.projectId, 0));
    }
    const analyticsCategoryIds = Array.isArray(filters.categoryIds)
      ? filters.categoryIds.map((x) => toInt(x, 0)).filter((x) => x > 0)
      : (filters.categoryId ? [toInt(filters.categoryId, 0)] : []);

    if (analyticsCategoryIds.length) {
      const placeholders = analyticsCategoryIds.map(() => "?").join(",");
      sessionTaskFilters.push(`EXISTS (SELECT 1 FROM task_categories tc WHERE tc.task_id = tx.id AND tc.category_id IN (${placeholders}))`);
      sessionValues.push(...analyticsCategoryIds);
    }
    if (filters.priority) {
      sessionTaskFilters.push("tx.priority = ?");
      sessionValues.push(filters.priority);
    }
    if (sessionTaskFilters.length) {
      sessionWhere.push(
        `EXISTS (SELECT 1 FROM tasks tx WHERE tx.id = pomodoro_sessions.task_id AND ${sessionTaskFilters.join(" AND ")})`
      );
    }

    const sessionsClause = sessionWhere.length
      ? `WHERE ${sessionWhere.join(" AND ")}`
      : "";

    const sessions = this.db
      .prepare(
        `SELECT * FROM pomodoro_sessions
         ${sessionsClause}
         ORDER BY ended_at`
      )
      .all(...sessionValues);

    const spentWhere = ["ps.kind = 'work'", "ps.was_interrupted = 0"];
    const spentValues = [];
    const spentTaskFilters = [];

    if (filters.projectId) {
      spentTaskFilters.push("tx.project_id = ?");
      spentValues.push(toInt(filters.projectId, 0));
    }
    if (analyticsCategoryIds.length) {
      const placeholders = analyticsCategoryIds.map(() => "?").join(",");
      spentTaskFilters.push(`EXISTS (SELECT 1 FROM task_categories tc WHERE tc.task_id = tx.id AND tc.category_id IN (${placeholders}))`);
      spentValues.push(...analyticsCategoryIds);
    }
    if (filters.priority) {
      spentTaskFilters.push("tx.priority = ?");
      spentValues.push(filters.priority);
    }
    if (spentTaskFilters.length) {
      spentWhere.push(
        `EXISTS (SELECT 1 FROM tasks tx WHERE tx.id = ps.task_id AND ${spentTaskFilters.join(" AND ")})`
      );
    }

    const spentClause = spentWhere.length ? `WHERE ${spentWhere.join(" AND ")}` : "";
    const spentByDay = this.db
      .prepare(
        `SELECT substr(ps.ended_at, 1, 10) as day, COUNT(*) as value
         FROM pomodoro_sessions ps
         ${spentClause}
         GROUP BY substr(ps.ended_at, 1, 10)
         ORDER BY day`
      )
      .all(...spentValues);

    return {
      tasks,
      sessions,
      spentByDay
    };
  }

  listArchive(filters = {}) {
    const where = [];
    const values = [];

    if (filters.descriptionFragment) {
      where.push("description_md LIKE ?");
      values.push(`%${String(filters.descriptionFragment).trim()}%`);
    }
    if (filters.projectId) {
      where.push("project_name = (SELECT name FROM projects WHERE id = ?)");
      values.push(toInt(filters.projectId, 0));
    }
    const archiveCategoryIds = Array.isArray(filters.categoryIds)
      ? filters.categoryIds.map((x) => toInt(x, 0)).filter((x) => x > 0)
      : (filters.categoryId ? [toInt(filters.categoryId, 0)] : []);

    if (archiveCategoryIds.length) {
      const placeholders = archiveCategoryIds.map(() => "?").join(",");
      const categoryNames = this.db
        .prepare(`SELECT name FROM categories WHERE id IN (${placeholders})`)
        .all(...archiveCategoryIds)
        .map((row) => row.name)
        .filter(Boolean);

      if (categoryNames.length) {
        where.push(`(${categoryNames.map(() => "category_name LIKE ?").join(" OR ")})`);
        values.push(...categoryNames.map((name) => `%${name}%`));
      }
    }
    if (filters.projectName) {
      where.push("project_name = ?");
      values.push(String(filters.projectName));
    }
    if (filters.categoryName) {
      where.push("category_name = ?");
      values.push(String(filters.categoryName));
    }
    if (filters.priority) {
      where.push("priority = ?");
      values.push(String(filters.priority));
    }
    if (filters.completedFrom) {
      where.push("completed_at >= ?");
      values.push(String(filters.completedFrom));
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    return this.db
      .prepare(
        `SELECT *
         FROM archive_tasks
         ${whereClause}
         ORDER BY completed_at DESC, id DESC`
      )
      .all(...values);
  }

  cloneArchiveTaskToInbox(archiveId) {
    const id = toInt(archiveId, 0);
    if (!id) throw new Error("Archive record id is required");

    const row = this.db.prepare("SELECT * FROM archive_tasks WHERE id = ?").get(id);
    if (!row) {
      throw new Error("Archive record not found");
    }

    const categoryNames = String(row.category_name || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    return this.createTask({
      subject: row.subject || "",
      result: row.result || "",
      descriptionMd: row.description_md,
      color: row.color || "#7dd3fc",
      priority: row.priority || null,
      scheduledAt: row.scheduled_at || null,
      startDate: row.start_date || null,
      endDate: row.end_date || null,
      plannedPomodoros: Number(row.planned_pomodoros || 1),
      spentPomodoros: 0,
      isCompleted: false,
      projectName: row.project_name || "",
      categoryIds: categoryNames,
      attributes: {},
      columnId: this.getInboxColumnId()
    });
  }

  deleteArchiveTask(archiveId) {
    const id = toInt(archiveId, 0);
    if (!id) throw new Error("Archive record id is required");
    const result = this.db.prepare("DELETE FROM archive_tasks WHERE id = ?").run(id);
    if (!result.changes) {
      throw new Error("Archive record not found");
    }
    return true;
  }

  addTaskToBacklog(taskId) {
    const id = toInt(taskId, 0);
    const task = this.getTaskById(id);
    if (!task) throw new Error("Task not found");

    const column = this.db.prepare("SELECT title FROM columns WHERE id = ?").get(task.column_id);
    if (!column) throw new Error("Task column not found");
    if (column.title === "Process" || column.title === "Done") {
      throw new Error("Tasks from Process and Done cannot be moved to Backlog");
    }

    this.db
      .prepare("INSERT OR IGNORE INTO backlog_tasks (task_id, added_at) VALUES (?, ?)")
      .run(id, nowIso());
    this.db.prepare("UPDATE tasks SET is_active = 0 WHERE id = ?").run(id);
    return true;
  }

  listBacklog(filters = {}) {
    const where = [];
    const values = [];

    if (filters.descriptionFragment) {
      where.push("t.description_md LIKE ?");
      values.push(`%${String(filters.descriptionFragment).trim()}%`);
    }
    if (filters.projectId) {
      where.push("t.project_id = ?");
      values.push(toInt(filters.projectId, 0));
    }
    const backlogCategoryIds = Array.isArray(filters.categoryIds)
      ? filters.categoryIds.map((x) => toInt(x, 0)).filter((x) => x > 0)
      : (filters.categoryId ? [toInt(filters.categoryId, 0)] : []);

    if (backlogCategoryIds.length) {
      const placeholders = backlogCategoryIds.map(() => "?").join(",");
      where.push(
        `EXISTS (
          SELECT 1 FROM task_categories tc
          WHERE tc.task_id = t.id
            AND tc.category_id IN (${placeholders})
        )`
      );
      values.push(...backlogCategoryIds);
    }
    if (filters.priority) {
      where.push("t.priority = ?");
      values.push(String(filters.priority));
    }
    if (filters.startDateFrom) {
      where.push("t.start_date >= ?");
      values.push(String(filters.startDateFrom));
    }
    if (filters.attributeKey && filters.attributeValue) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM task_attributes ta
          WHERE ta.task_id = t.id
            AND ta.key = ?
            AND ta.value LIKE ?
        )`
      );
      values.push(String(filters.attributeKey).trim(), `%${String(filters.attributeValue).trim()}%`);
    } else if (filters.attributeKey) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM task_attributes ta
          WHERE ta.task_id = t.id
            AND ta.key = ?
        )`
      );
      values.push(String(filters.attributeKey).trim());
    } else if (filters.attributeValue) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM task_attributes ta
          WHERE ta.task_id = t.id
            AND ta.value LIKE ?
        )`
      );
      values.push(`%${String(filters.attributeValue).trim()}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT
           t.*,
           p.name as project_name,
           c.name as category_name,
           col.title as column_title,
           bl.added_at
         FROM backlog_tasks bl
         JOIN tasks t ON t.id = bl.task_id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN columns col ON col.id = t.column_id
         ${whereClause}
         ORDER BY bl.added_at DESC, t.id DESC`
      )
      .all(...values);
    this.attachCategoriesToTasks(rows);
    return rows;
  }

  moveTaskFromBacklog(taskId, toColumnId) {
    const id = toInt(taskId, 0);
    const targetColumnId = toInt(toColumnId, 0);

    const column = this.db.prepare("SELECT title FROM columns WHERE id = ?").get(targetColumnId);
    if (!column) throw new Error("Target column not found");
    if (column.title === "Process" || column.title === "Done") {
      throw new Error("Backlog tasks can be moved only to non-Process/Done columns");
    }

    const task = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!task) throw new Error("Task not found");
    const targetOrder = this.nextTaskOrder(targetColumnId);

    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM backlog_tasks WHERE task_id = ?").run(id);
      this.db
        .prepare("UPDATE tasks SET column_id = ?, sort_order = ? WHERE id = ?")
        .run(targetColumnId, targetOrder, id);
      this.db
        .prepare(
          "INSERT INTO task_moves (task_id, from_column_id, to_column_id, moved_at) VALUES (?, ?, ?, ?)"
        )
        .run(id, task.column_id, targetColumnId, nowIso());
    });
    tx();
    return this.getTaskById(id);
  }
}

export const DB_CONSTANTS = {
  MANDATORY_COLUMNS
};
