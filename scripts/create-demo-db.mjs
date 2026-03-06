import fs from "node:fs";
import path from "node:path";
import { AppDatabase } from "../src/main/db.js";

const outputArg = process.argv[2] || "demo-data/actio-demo.sqlite";
const outputPath = path.resolve(outputArg);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

const appDb = new AppDatabase(outputPath);
const raw = appDb.db;

const columns = raw.prepare("SELECT id, title FROM columns").all();
const columnByTitle = new Map(columns.map((row) => [row.title, Number(row.id)]));

function col(title) {
  const id = columnByTitle.get(title);
  if (!id) throw new Error(`Column not found: ${title}`);
  return id;
}

function at(dayOffset, hour, minute) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(dayOffset || 0));
  d.setHours(Number(hour || 0), Number(minute || 0), 0, 0);
  return d.toISOString();
}

function dateOnly(dayOffset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Number(dayOffset || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

appDb.updateSettings({
  language: "ru",
  theme: "light",
  workMinutes: "25",
  shortBreakMinutes: "5",
  longBreakMinutes: "20",
  workdayStart: "08:30",
  workdayEnd: "19:00",
  kanbanProcessView: "today"
});

for (const projectName of ["Личное", "Работа", "Обучение", "Здоровье", "Дом"]) {
  appDb.createProject(projectName);
}

for (const categoryName of ["Планирование", "Фокус", "Встречи", "Поручения", "Обучение", "Финансы", "Документы"]) {
  appDb.createCategory(categoryName);
}

appDb.createColumn("Review");
columnByTitle.set("Review", Number(raw.prepare("SELECT id FROM columns WHERE title = ?").get("Review").id));

const tasks = {};
const create = (key, payload) => {
  tasks[key] = appDb.createTask(payload);
  return tasks[key];
};

create("plan-week", {
  subject: "План недели",
  result: "",
  descriptionMd: "- Проверить календарь\n- Выбрать 3 главные цели\n- Разложить задачи по дням",
  color: "#7dd3fc",
  priority: "B",
  scheduledAt: at(1, 9, 30),
  startDate: dateOnly(1),
  plannedPomodoros: 2,
  projectName: "Личное",
  categoryIds: ["Планирование"],
  attributes: { context: "weekly", energy: "medium" },
  columnId: col("Inbox")
});

create("buy-groceries", {
  subject: "Закупить продукты",
  result: "",
  descriptionMd: "- Молоко\n- Овощи\n- Крупы\n- Кофе",
  color: "#86efac",
  priority: "C",
  scheduledAt: at(0, 18, 0),
  startDate: dateOnly(0),
  plannedPomodoros: 1,
  projectName: "Дом",
  categoryIds: ["Поручения"],
  attributes: { place: "магазин у дома" },
  columnId: col("Inbox")
});

create("roadmap", {
  subject: "Черновик roadmap Q2",
  result: "",
  descriptionMd: "Подготовить **черновик roadmap**:\n1. Цели квартала\n2. Риски\n3. Зависимости",
  color: "#60a5fa",
  priority: "A",
  scheduledAt: at(0, 11, 0),
  startDate: dateOnly(0),
  plannedPomodoros: 4,
  projectName: "Работа",
  categoryIds: ["Планирование", "Фокус"],
  attributes: { team: "platform", owner: "product" },
  columnId: col("Organise")
});

create("demo-script", {
  subject: "Подготовить demo-скрипт",
  result: "",
  descriptionMd: "Сделать сценарий демо:\n- вступление\n- путь пользователя\n- KPI до/после",
  color: "#818cf8",
  priority: "A",
  scheduledAt: at(0, 14, 0),
  startDate: dateOnly(0),
  plannedPomodoros: 3,
  projectName: "Работа",
  categoryIds: ["Фокус", "Документы"],
  attributes: { audience: "руководство" },
  columnId: col("Organise")
});

create("legal-feedback", {
  subject: "Дождаться ответа юристов",
  result: "",
  descriptionMd: "Ожидается проверка договора по NDA.",
  color: "#94a3b8",
  priority: "B",
  scheduledAt: at(2, 10, 0),
  startDate: dateOnly(2),
  plannedPomodoros: 1,
  projectName: "Работа",
  categoryIds: ["Документы"],
  attributes: { blocker: "external" },
  columnId: col("Wait")
});

create("active-docker", {
  subject: "Контейнеризация с noVNC",
  result: "",
  descriptionMd: "Довести запуск приложения через Docker Compose и noVNC.\n\nЧеклист:\n- Dockerfile\n- docker-compose\n- проверка",
  color: "#67e8f9",
  priority: "A",
  scheduledAt: at(0, 10, 0),
  startDate: dateOnly(0),
  plannedPomodoros: 5,
  spentPomodoros: 1,
  projectName: "Работа",
  categoryIds: ["Фокус"],
  attributes: { epic: "infra", risk: "medium" },
  columnId: col("Process")
});

create("read-paper", {
  subject: "Прочитать статью по LLM eval",
  result: "",
  descriptionMd: "Прочитать и выписать 5 идей для применения в продукте.",
  color: "#fcd34d",
  priority: "B",
  scheduledAt: at(3, 9, 0),
  startDate: dateOnly(3),
  plannedPomodoros: 2,
  projectName: "Обучение",
  categoryIds: ["Обучение"],
  attributes: { source: "arxiv" },
  columnId: col("Review")
});

create("retro-notes", {
  subject: "Закрыть заметки ретро",
  result: "Итог: выделили 3 улучшения процесса, назначили ответственных.",
  descriptionMd: "Собрать договоренности ретро и перенести в трекер.",
  color: "#a78bfa",
  priority: "B",
  scheduledAt: at(-2, 16, 0),
  startDate: dateOnly(-2),
  endDate: dateOnly(-1),
  plannedPomodoros: 2,
  spentPomodoros: 2,
  isCompleted: true,
  projectName: "Работа",
  categoryIds: ["Встречи", "Документы"],
  attributes: { sprint: "24.03" },
  columnId: col("Done")
});

create("pay-bills", {
  subject: "Оплатить счета",
  result: "Счета за интернет и электричество оплачены.",
  descriptionMd: "Проверить суммы и провести оплату через банк.",
  color: "#f9a8d4",
  priority: "C",
  scheduledAt: at(-4, 20, 0),
  startDate: dateOnly(-4),
  endDate: dateOnly(-4),
  plannedPomodoros: 1,
  spentPomodoros: 1,
  isCompleted: true,
  projectName: "Личное",
  categoryIds: ["Финансы"],
  attributes: { month: "current" },
  columnId: col("Done")
});

create("doctor", {
  subject: "Записаться на медосмотр",
  result: "",
  descriptionMd: "Найти окно в расписании и записаться через приложение клиники.",
  color: "#bef264",
  priority: "C",
  scheduledAt: at(4, 12, 30),
  startDate: dateOnly(4),
  plannedPomodoros: 1,
  projectName: "Здоровье",
  categoryIds: ["Поручения"],
  attributes: { reminder: "true" },
  columnId: col("Organise")
});

create("tax-docs", {
  subject: "Подготовить документы для налоговой",
  result: "",
  descriptionMd: "Собрать справки и чеки за прошлый год.",
  color: "#fdba74",
  priority: "A",
  scheduledAt: at(2, 15, 0),
  startDate: dateOnly(2),
  plannedPomodoros: 3,
  projectName: "Личное",
  categoryIds: ["Документы", "Финансы"],
  attributes: { due: dateOnly(10) },
  columnId: col("Organise")
});

appDb.moveTask(tasks["plan-week"].id, col("Organise"));
appDb.moveTask(tasks["read-paper"].id, col("Organise"));
appDb.moveTask(tasks["read-paper"].id, col("Review"));

appDb.addTaskToBacklog(tasks["buy-groceries"].id);
appDb.addTaskToBacklog(tasks["read-paper"].id);

appDb.setActiveTask(tasks["active-docker"].id);

const sessions = [
  { task: "active-docker", day: -2, h: 10, m: 0, dur: 25, interrupted: false },
  { task: "active-docker", day: -2, h: 11, m: 0, dur: 25, interrupted: true },
  { task: "active-docker", day: -1, h: 9, m: 30, dur: 25, interrupted: false },
  { task: "roadmap", day: -3, h: 14, m: 0, dur: 25, interrupted: false },
  { task: "roadmap", day: -3, h: 15, m: 0, dur: 25, interrupted: false },
  { task: "demo-script", day: -1, h: 16, m: 0, dur: 25, interrupted: false },
  { task: "retro-notes", day: -4, h: 10, m: 0, dur: 25, interrupted: false },
  { task: "pay-bills", day: -5, h: 20, m: 0, dur: 20, interrupted: false }
];

for (const row of sessions) {
  const startedAt = at(row.day, row.h, row.m);
  const endedAt = new Date(new Date(startedAt).getTime() + row.dur * 60_000).toISOString();
  const taskRow = tasks[row.task];
  appDb.recordPomodoroSession({
    taskId: taskRow?.id || null,
    kind: "work",
    durationMinutes: row.dur,
    startedAt,
    endedAt,
    wasInterrupted: row.interrupted,
    taskSnapshot: taskRow?.subject || ""
  });
}

function forceCompletedAt(taskId, completedAtIso) {
  raw.prepare("UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?").run(completedAtIso, taskId);
  raw
    .prepare("UPDATE archive_tasks SET completed_at = ?, archived_at = ? WHERE task_id = ?")
    .run(
      completedAtIso,
      new Date(new Date(completedAtIso).getTime() + 60_000).toISOString(),
      taskId
    );
}

forceCompletedAt(tasks["retro-notes"].id, at(-1, 18, 40));
forceCompletedAt(tasks["pay-bills"].id, at(-4, 21, 15));

const counters = {
  columns: raw.prepare("SELECT COUNT(*) AS c FROM columns").get().c,
  projects: raw.prepare("SELECT COUNT(*) AS c FROM projects").get().c,
  categories: raw.prepare("SELECT COUNT(*) AS c FROM categories").get().c,
  tasks: raw.prepare("SELECT COUNT(*) AS c FROM tasks").get().c,
  backlog: raw.prepare("SELECT COUNT(*) AS c FROM backlog_tasks").get().c,
  archive: raw.prepare("SELECT COUNT(*) AS c FROM archive_tasks").get().c,
  sessions: raw.prepare("SELECT COUNT(*) AS c FROM pomodoro_sessions").get().c
};

appDb.close();

console.log("Demo database created:", outputPath);
console.log(JSON.stringify(counters, null, 2));
