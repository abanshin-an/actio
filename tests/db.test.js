import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppDatabase } from "../src/main/db.js";

function detectDbSkipReason() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "actio-test-probe-"));
  const dbPath = path.join(tempDir, "probe.sqlite");
  let db = null;

  try {
    db = new AppDatabase(dbPath);
    return null;
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("NODE_MODULE_VERSION") || message.includes("ERR_DLOPEN_FAILED")) {
      return "better-sqlite3 binary is not compatible with current Node runtime";
    }
    throw error;
  } finally {
    if (db) db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const dbSkipReason = detectDbSkipReason();

function withDb(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "actio-test-"));
  const dbPath = path.join(tempDir, "test.sqlite");
  const db = new AppDatabase(dbPath);

  try {
    run(db);
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("database initializes mandatory columns and default settings", { skip: dbSkipReason }, () => {
  withDb((db) => {
    const board = db.loadBoard();
    const titles = board.columns.map((column) => column.title);

    assert.deepEqual(titles, ["Inbox", "Organise", "Wait", "Process", "Done"]);
    assert.equal(board.settings.workMinutes, "25");
    assert.equal(board.settings.shortBreakMinutes, "5");
    assert.equal(board.settings.longBreakMinutes, "30");
  });
});

test("scheduled tasks are shifted to avoid overlap", { skip: dbSkipReason }, () => {
  withDb((db) => {
    const first = db.createTask({
      descriptionMd: "task one",
      scheduledAt: "2026-02-26T10:00:00.000Z"
    });

    const second = db.createTask({
      descriptionMd: "task two",
      scheduledAt: "2026-02-26T10:00:00.000Z"
    });

    assert.equal(first.scheduled_at, "2026-02-26T10:00:00.000Z");
    assert.equal(second.scheduled_at, "2026-02-26T10:25:00.000Z");
  });
});

test("backlog flow and archive integration work", { skip: dbSkipReason }, () => {
  withDb((db) => {
    const task = db.createTask({ descriptionMd: "backlog candidate" });
    const board = db.loadBoard();
    const organiseId = board.columns.find((column) => column.title === "Organise")?.id;
    const processId = board.columns.find((column) => column.title === "Process")?.id;

    assert.ok(organiseId);
    assert.ok(processId);

    db.addTaskToBacklog(task.id);
    const backlog = db.listBacklog();
    assert.equal(backlog.length, 1);
    assert.equal(backlog[0].id, task.id);

    assert.throws(
      () => db.moveTaskFromBacklog(task.id, processId),
      /Backlog tasks can be moved only to non-Process\/Done columns/
    );

    const moved = db.moveTaskFromBacklog(task.id, organiseId);
    assert.equal(moved.column_id, organiseId);
    assert.equal(db.listBacklog().length, 0);

    db.completeTask(task.id);
    const archive = db.listArchive();
    assert.equal(archive.length, 1);
    assert.equal(archive[0].task_id, task.id);
  });
});
