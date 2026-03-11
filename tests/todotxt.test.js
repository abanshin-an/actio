import test from "node:test";
import assert from "node:assert/strict";
import { parseTodoTxt } from "../src/main/todotxt.js";

test("parseTodoTxt parses active line with metadata", () => {
  const parsed = parseTodoTxt("(A) 2026-02-20 Подготовить_отчет +Work @office due:2026-02-21 skd:2026-02-20T10:00:00Z");

  assert.equal(parsed.isCompleted, false);
  assert.equal(parsed.priority, "A");
  assert.equal(parsed.creationDate, "2026-02-20");
  assert.equal(parsed.completionDate, null);
  assert.deepEqual(parsed.projects, ["Work"]);
  assert.deepEqual(parsed.contexts, ["office"]);
  assert.deepEqual(parsed.keyValues, {
    due: "2026-02-21",
    skd: "2026-02-20T10:00:00Z"
  });
  assert.equal(parsed.description, "Подготовить_отчет");
});

test("parseTodoTxt parses completed line", () => {
  const parsed = parseTodoTxt("x 2026-02-22 2026-02-20 (B) close_task +Ops @remote est:3h");

  assert.equal(parsed.isCompleted, true);
  assert.equal(parsed.completionDate, "2026-02-22");
  assert.equal(parsed.creationDate, "2026-02-20");
  assert.equal(parsed.priority, "B");
  assert.deepEqual(parsed.projects, ["Ops"]);
  assert.deepEqual(parsed.contexts, ["remote"]);
  assert.deepEqual(parsed.keyValues, { est: "3h" });
  assert.equal(parsed.description, "close_task");
});

test("parseTodoTxt throws on empty input", () => {
  assert.throws(() => parseTodoTxt("   "), /empty/i);
});
