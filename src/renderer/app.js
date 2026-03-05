import { marked } from "../../node_modules/marked/lib/marked.esm.js";

const state = {
  board: null,
  selectedTaskId: null,
  filters: {
    descriptionFragment: "",
    projectId: "",
    categoryIds: [],
    priority: "",
    startDateFrom: "",
    attributeKey: "",
    attributeValue: ""
  },
  analyticsFilters: {
    projectId: "",
    categoryIds: [],
    priority: ""
  },
  analyticsDeviationGroupBy: "task",
  backlogFilters: {
    descriptionFragment: "",
    projectId: "",
    categoryIds: [],
    priority: "",
    startDateFrom: "",
    attributeKey: "",
    attributeValue: ""
  },
  archiveFilters: {
    descriptionFragment: "",
    projectId: "",
    categoryIds: [],
    priority: "",
    completedFrom: ""
  },
  settings: {
    workMinutes: "25",
    shortBreakMinutes: "5",
    longBreakMinutes: "30",
    workdayStart: "09:00",
    workdayEnd: "18:00",
    kanbanProcessView: "today",
    theme: "light",
    language: "ru",
    timerTickingEnabled: "0",
    markdownExtendedEnabled: "1"
  },
  language: "ru",
  timer: {
    running: false,
    kind: "work",
    remainingSec: 25 * 60,
    plannedDurationSec: 25 * 60,
    sessionStartedAt: null,
    intervalId: null,
    taskId: null,
    workStreak: 0
  },
  sessionDialog: {
    countdown: 10,
    intervalId: null
  },
  analytics: {
    tasks: [],
    sessions: []
  },
  calendarSessions: [],
  calendarScheduled: [],
  archive: [],
  backlog: [],
  backlogSort: { key: "id", dir: "desc" },
  archiveSort: { key: "completed_at", dir: "desc" },
  taskCategoryIds: [],
  dbProfiles: {
    profiles: [],
    selectedPath: "",
    currentPath: ""
  },
  taskEditorEnabled: false,
  taskEditorResultOnly: false,
  contextMenuTaskId: null,
  contextMenuMode: "default",
  backlogMenuTaskId: null,
  archiveMenuRowId: null,
  autoScheduledStartedKeys: new Set()
};

const CARD_COLOR_PRESETS = [
  "#7dd3fc", "#60a5fa", "#818cf8", "#a78bfa",
  "#f9a8d4", "#fb7185", "#fca5a5", "#fdba74",
  "#fcd34d", "#bef264", "#86efac", "#67e8f9",
  "#94a3b8", "#d4d4d8", "#e5e7eb", "#f3f4f6"
];

const api = window.api
  || new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `Desktop bridge API unavailable (${String(
            prop
          )}). Restart via Electron and verify preload is loaded.`
        );
      }
    }
  );

const I18N = {
  ru: {
    appTitle: "actio",
    appSubtitle: "Управление задачами, фокусом и производительностью",
    tabKanban: "Канбан",
    tabPomodoro: "Помодоро",
    tabAnalytics: "Анализ",
    tabBacklog: "Бэклог",
    tabCalendar: "Календарь",
    tabArchive: "Архив",
    tabSettings: "Настройки",
    quickAdd: "Быстрый ввод todo.txt",
    add: "Добавить",
    filters: "Фильтры",
    filterDescription: "Фрагмент описания",
    anyPriority: "Любой приоритет",
    attrKey: "Ключ атрибута",
    attrValue: "Значение атрибута",
    apply: "Применить",
    reset: "Сбросить",
    taskEditor: "Редактор задачи",
    subject: "Тема",
    result: "Результат",
    taskDescription: "Описание (Markdown)",
    project: "Проект",
    category: "Категория",
    noPriority: "Без приоритета",
    plannedPomodoros: "План помидоров",
    spentPomodoros: "Факт помидоров",
    cardColor: "Цвет карточки",
    attributesPlaceholder: "key:value (каждая пара с новой строки)",
    completed: "Завершена",
    scheduledAt: "План: дата и время старта",
    saveTask: "Сохранить задачу",
    newTask: "Новая задача",
    metadata: "Проекты и категории",
    newProject: "Новый проект",
    addProject: "Добавить проект",
    newCategory: "Новая категория",
    addCategory: "Добавить категорию",
    createEmptyDb: "Создать новую БД",
    newColumn: "Новая колонка",
    addColumn: "Добавить колонку",
    pomodoroTimer: "Помодоро-таймер",
    start: "Старт",
    interrupt: "Прервать",
    markDone: "Отметить задачу выполненной",
    nextPomodoro: "Следующий помидор",
    currentTask: "Текущая задача",
    analyticsFilters: "Фильтры анализа",
    calendarTitle: "Календарь выполнения помидоров",
    activityHeatmap: "Тепловая карта активности",
    flowMetrics: "Метрики потока",
    wipDynamics: "Динамика WIP (30 дней)",
    planVsFact: "Отклонение план/факт по задачам",
    planFactGroupBy: "Группировка",
    groupByTask: "По задачам",
    groupByProject: "По проектам",
    groupByCategory: "По категориям",
    groupByPriority: "По приоритетам",
    pomodoroSettings: "Настройки помодоро",
    workMinutes: "Работа (мин)",
    shortBreak: "Короткий перерыв",
    longBreak: "Длинный перерыв",
    workdaySettings: "Рабочий день",
    workdayStart: "Начало рабочего дня",
    workdayEnd: "Окончание рабочего дня",
    uiSettings: "Интерфейс",
    kanbanProcessView: "Панель Канбан (Процесс)",
    kanbanProcessViewToday: "Колонка Сегодня",
    kanbanProcessViewProcess: "Колонка Процесс",
    theme: "Тема",
    systemTheme: "Системная",
    lightTheme: "Светлая",
    darkTheme: "Темная",
    language: "Язык",
    saveSettings: "Сохранить настройки",
    timerTicking: "Тиканье таймера",
    markdownExtended: "Расширенный Markdown",
    countdownTitle: "Отсчет",
    sessionFinished: "Помидор завершен",
    startBreak: "Перерыв"
    ,
    confirmPomodoroInterrupt: "Прервать текущую помидоро-сессию?",
    confirmTaskCompleteFromPomodoro: "Отметить текущую задачу выполненной?",
    cloneToInbox: "Клонировать во Входящие",
    cloneToInboxRu: "Клонировать в Входящие",
    viewTask: "Просмотр задачи",
    archiveTaskView: "Просмотр задачи",
    dates: "Даты",
    pomodorosCount: "Количество помидоров",
    archiveDateStart: "Старт",
    archiveDateEnd: "Дедлайн",
    archiveDateCompleted: "Завершена",
    archiveDateArchived: "Архивирована",
    noData: "Нет данных",
    deleteFromArchive: "Удалить",
    archiveDeleteConfirm: "Удалить запись из архива?",
    backlogEdit: "Редактирование",
    backlogDelete: "Удалить",
    backlogDeleteConfirm: "Удалить задачу из Бэклога? Это действие нельзя отменить."
  },
  en: {
    appTitle: "actio",
    appSubtitle: "Task flow, focus, and productivity tracking",
    tabKanban: "Kanban",
    tabPomodoro: "Pomodoro",
    tabAnalytics: "Analytics",
    tabBacklog: "Backlog",
    tabCalendar: "Calendar",
    tabArchive: "Archive",
    tabSettings: "Settings",
    quickAdd: "Quick todo.txt input",
    add: "Add",
    filters: "Filters",
    filterDescription: "Description fragment",
    anyPriority: "Any priority",
    attrKey: "Attribute key",
    attrValue: "Attribute value",
    apply: "Apply",
    reset: "Reset",
    taskEditor: "Task editor",
    subject: "Subject",
    result: "Result",
    taskDescription: "Description (Markdown)",
    project: "Project",
    category: "Category",
    noPriority: "No priority",
    plannedPomodoros: "Planned pomodoros",
    spentPomodoros: "Spent pomodoros",
    cardColor: "Card color",
    attributesPlaceholder: "key:value (one pair per line)",
    completed: "Completed",
    scheduledAt: "Planned start (date/time)",
    saveTask: "Save task",
    newTask: "New Task",
    metadata: "Projects and categories",
    newProject: "New project",
    addProject: "Add project",
    newCategory: "New category",
    addCategory: "Add category",
    createEmptyDb: "Create New DB",
    newColumn: "New column",
    addColumn: "Add column",
    pomodoroTimer: "Pomodoro timer",
    start: "Start",
    interrupt: "Interrupt",
    markDone: "Mark task done",
    nextPomodoro: "Next pomodoro",
    currentTask: "Current task",
    analyticsFilters: "Analytics filters",
    calendarTitle: "Pomodoro execution calendar",
    activityHeatmap: "Activity heatmap",
    flowMetrics: "Flow metrics",
    wipDynamics: "WIP dynamics (30 days)",
    planVsFact: "Plan vs actual deviation",
    planFactGroupBy: "Group by",
    groupByTask: "By tasks",
    groupByProject: "By projects",
    groupByCategory: "By categories",
    groupByPriority: "By priorities",
    pomodoroSettings: "Pomodoro settings",
    workMinutes: "Work (min)",
    shortBreak: "Short break",
    longBreak: "Long break",
    workdaySettings: "Workday",
    workdayStart: "Workday start",
    workdayEnd: "Workday end",
    uiSettings: "UI",
    kanbanProcessView: "Kanban panel (Process)",
    kanbanProcessViewToday: "Today column",
    kanbanProcessViewProcess: "Process column",
    theme: "Theme",
    systemTheme: "System",
    lightTheme: "Light",
    darkTheme: "Dark",
    language: "Language",
    saveSettings: "Save settings",
    timerTicking: "Timer ticking sound",
    countdownTitle: "Countdown",
    sessionFinished: "Pomodoro finished",
    startBreak: "Break"
    ,
    confirmPomodoroInterrupt: "Interrupt current pomodoro session?",
    confirmTaskCompleteFromPomodoro: "Mark current task as completed?",
    cloneToInbox: "Clone to Inbox",
    cloneToInboxRu: "Clone to Inbox",
    viewTask: "View task",
    archiveTaskView: "Task view",
    dates: "Dates",
    pomodorosCount: "Pomodoro count",
    archiveDateStart: "Start",
    archiveDateEnd: "Deadline",
    archiveDateCompleted: "Completed",
    archiveDateArchived: "Archived",
    noData: "No data",
    deleteFromArchive: "Delete",
    archiveDeleteConfirm: "Delete archive record?",
    backlogEdit: "Edit",
    backlogDelete: "Delete",
    backlogDeleteConfirm: "Delete task from Backlog? This action cannot be undone."
  }
};

const LOCALE_BY_LANGUAGE = {
  ru: "ru-RU",
  en: "en-US",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
  be: "be-BY",
  sr: "sr-RS",
  ka: "ka-GE"
};

Object.assign(I18N, {
  it: {
    ...I18N.en,
    tabKanban: "Kanban",
    tabPomodoro: "Pomodoro",
    tabAnalytics: "Analisi",
    tabBacklog: "Backlog",
    tabCalendar: "Calendario",
    tabArchive: "Archivio",
    tabSettings: "Impostazioni",
    filters: "Filtri",
    taskEditor: "Editor attività",
    saveTask: "Salva attività",
    newTask: "Nuova attività",
    addColumn: "Aggiungi colonna",
    pomodoroTimer: "Timer Pomodoro",
    analyticsFilters: "Filtri analisi",
    saveSettings: "Salva impostazioni",
    language: "Lingua"
  },
  de: {
    ...I18N.en,
    tabKanban: "Kanban",
    tabPomodoro: "Pomodoro",
    tabAnalytics: "Analyse",
    tabBacklog: "Backlog",
    tabCalendar: "Kalender",
    tabArchive: "Archiv",
    tabSettings: "Einstellungen",
    filters: "Filter",
    taskEditor: "Aufgabeneditor",
    saveTask: "Aufgabe speichern",
    newTask: "Neue Aufgabe",
    addColumn: "Spalte hinzufügen",
    pomodoroTimer: "Pomodoro-Timer",
    analyticsFilters: "Analysefilter",
    saveSettings: "Einstellungen speichern",
    language: "Sprache"
  },
  fr: {
    ...I18N.en,
    tabKanban: "Kanban",
    tabPomodoro: "Pomodoro",
    tabAnalytics: "Analyse",
    tabBacklog: "Backlog",
    tabCalendar: "Calendrier",
    tabArchive: "Archive",
    tabSettings: "Paramètres",
    filters: "Filtres",
    taskEditor: "Éditeur de tâche",
    saveTask: "Enregistrer la tâche",
    newTask: "Nouvelle tâche",
    addColumn: "Ajouter une colonne",
    pomodoroTimer: "Minuteur Pomodoro",
    analyticsFilters: "Filtres d'analyse",
    saveSettings: "Enregistrer les paramètres",
    language: "Langue"
  },
  be: {
    ...I18N.en,
    tabKanban: "Канбан",
    tabPomodoro: "Памодора",
    tabAnalytics: "Аналітыка",
    tabBacklog: "Бэклог",
    tabCalendar: "Каляндар",
    tabArchive: "Архіў",
    tabSettings: "Налады",
    filters: "Фільтры",
    taskEditor: "Рэдактар задачы",
    saveTask: "Захаваць задачу",
    newTask: "Новая задача",
    addColumn: "Дадаць калонку",
    pomodoroTimer: "Таймер Памодора",
    analyticsFilters: "Фільтры аналітыкі",
    saveSettings: "Захаваць налады",
    language: "Мова"
  },
  sr: {
    ...I18N.en,
    tabKanban: "Канбан",
    tabPomodoro: "Помодоро",
    tabAnalytics: "Аналитика",
    tabBacklog: "Беклог",
    tabCalendar: "Календар",
    tabArchive: "Архива",
    tabSettings: "Подешавања",
    filters: "Филтери",
    taskEditor: "Уређивач задатака",
    saveTask: "Сачувај задатак",
    newTask: "Нови задатак",
    addColumn: "Додај колону",
    pomodoroTimer: "Помодоро тајмер",
    analyticsFilters: "Филтери аналитике",
    saveSettings: "Сачувај подешавања",
    language: "Језик"
  },
  ka: {
    ...I18N.en,
    tabKanban: "კანბანი",
    tabPomodoro: "პომოდორო",
    tabAnalytics: "ანალიტიკა",
    tabBacklog: "ბექლოგი",
    tabCalendar: "კალენდარი",
    tabArchive: "არქივი",
    tabSettings: "პარამეტრები",
    filters: "ფილტრები",
    taskEditor: "ამოცანის რედაქტორი",
    saveTask: "ამოცანის შენახვა",
    newTask: "ახალი ამოცანა",
    addColumn: "სვეტის დამატება",
    pomodoroTimer: "პომოდორო ტაიმერი",
    analyticsFilters: "ანალიტიკის ფილტრები",
    saveSettings: "პარამეტრების შენახვა",
    language: "ენა"
  }
});

const els = {
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  pomodoroTabBtn: document.querySelector('.tab-btn[data-tab="pomodoro"]'),
  board: document.getElementById("kanban-board"),
  toast: document.getElementById("toast"),
  headerActiveTask: document.getElementById("header-active-task"),

  todotxtInput: document.getElementById("todotxt-input"),
  todotxtAddBtn: document.getElementById("todotxt-add-btn"),

  filterDescription: document.getElementById("filter-description"),
  filterProject: document.getElementById("filter-project"),
  filterCategoryChips: document.getElementById("filter-category-chips"),
  filterPriority: document.getElementById("filter-priority"),
  filterStartDate: document.getElementById("filter-start-date"),
  filterAttrKey: document.getElementById("filter-attr-key"),
  filterAttrValue: document.getElementById("filter-attr-value"),
  applyFiltersBtn: document.getElementById("apply-filters-btn"),
  resetFiltersBtn: document.getElementById("reset-filters-btn"),

  taskForm: document.getElementById("task-form"),
  taskId: document.getElementById("task-id"),
  taskSubject: document.getElementById("task-subject"),
  taskResult: document.getElementById("task-result"),
  taskDescription: document.getElementById("task-description"),
  taskProject: document.getElementById("task-project"),
  taskCategoryChips: document.getElementById("task-category-chips"),
  taskPriority: document.getElementById("task-priority"),
  taskStartDate: document.getElementById("task-start-date"),
  taskEndDate: document.getElementById("task-end-date"),
  taskScheduledAt: document.getElementById("task-scheduled-at"),
  taskPlanned: document.getElementById("task-planned"),
  taskSpent: document.getElementById("task-spent"),
  taskColor: document.getElementById("task-color"),
  taskColorPalette: document.getElementById("task-color-palette"),
  taskColorPreview: document.getElementById("task-color-preview"),
  taskColorValue: document.getElementById("task-color-value"),
  taskAttributes: document.getElementById("task-attributes"),
  taskCompleted: null,
  taskNewBtn: document.getElementById("task-new-btn"),
  taskEditorHint: document.getElementById("task-editor-hint"),
  taskEditorModal: document.getElementById("task-editor-modal"),
  closeTaskEditorModalBtn: document.getElementById("close-task-editor-modal-btn"),

  addColumnBtn: document.getElementById("add-column-btn"),
  newColumnTitle: document.getElementById("new-column-title"),

  addProjectBtn: document.getElementById("add-project-btn"),
  addCategoryBtn: document.getElementById("add-category-btn"),
  newProjectName: document.getElementById("new-project-name"),
  newCategoryName: document.getElementById("new-category-name"),
  projectsList: document.getElementById("projects-list"),

  taskContextMenu: document.getElementById("task-context-menu"),
  contextStartStopBtn: document.getElementById("context-start-stop-btn"),
  contextWaitBtn: document.getElementById("context-wait-btn"),
  contextDoneBtn: document.getElementById("context-done-btn"),
  contextCloneBtn: document.getElementById("context-clone-btn"),
  contextEditBtn: document.getElementById("context-edit-btn"),
  contextBacklogBtn: document.getElementById("context-backlog-btn"),
  contextDeleteBtn: document.getElementById("context-delete-btn"),
  backlogTaskMenu: document.getElementById("backlog-task-menu"),
  backlogMenuMoveList: document.getElementById("backlog-menu-move-list"),
  backlogMenuEditBtn: document.getElementById("backlog-menu-edit-btn"),
  backlogMenuDeleteBtn: document.getElementById("backlog-menu-delete-btn"),
  backlogMoveMenu: document.getElementById("backlog-move-menu"),
  archiveTaskMenu: document.getElementById("archive-task-menu"),
  archiveMenuViewBtn: document.getElementById("archive-menu-view-btn"),
  archiveMenuCreateBtn: document.getElementById("archive-menu-create-btn"),
  archiveMenuDeleteBtn: document.getElementById("archive-menu-delete-btn"),
  archiveTaskViewModal: document.getElementById("archive-task-view-modal"),
  closeArchiveTaskViewModalBtn: document.getElementById("close-archive-task-view-modal-btn"),
  archiveViewId: document.getElementById("archive-view-id"),
  archiveViewSubject: document.getElementById("archive-view-subject"),
  archiveViewDescription: document.getElementById("archive-view-description"),
  archiveViewResult: document.getElementById("archive-view-result"),
  archiveViewProject: document.getElementById("archive-view-project"),
  archiveViewCategories: document.getElementById("archive-view-categories"),
  archiveViewPlanned: document.getElementById("archive-view-planned"),
  archiveViewSpent: document.getElementById("archive-view-spent"),
  archiveViewPomodorosCount: document.getElementById("archive-view-pomodoros-count"),
  archiveViewDates: document.getElementById("archive-view-dates"),
  archiveViewAttributes: document.getElementById("archive-view-attributes"),
  archiveViewCloneBtn: document.getElementById("archive-view-clone-btn"),

  timerKind: document.getElementById("timer-kind"),
  timerDisplay: document.getElementById("timer-display"),
  countdownValue: document.getElementById("countdown-value"),
  countdownProgress: document.getElementById("countdown-progress"),
  countdownGaugeRing: document.getElementById("countdown-gauge-ring"),
  countdownGaugeRingGloss: document.getElementById("countdown-gauge-ring-gloss"),
  countdownGaugeValue: document.getElementById("countdown-gauge-value"),
  timerMeta: document.getElementById("timer-meta"),
  timerStopBtn: document.getElementById("timer-stop-btn"),
  timerMarkDoneBtn: document.getElementById("timer-mark-done-btn"),
  pomodoroActiveTask: document.getElementById("pomodoro-active-task"),

  sessionDialog: document.getElementById("session-dialog"),
  sessionDialogText: document.getElementById("session-dialog-text"),
  sessionDialogCountdown: document.getElementById("session-dialog-countdown"),
  sessionBreakBtn: document.getElementById("session-break-btn"),
  sessionNextBtn: document.getElementById("session-next-btn"),

  analyticsFilterProject: document.getElementById("analytics-filter-project"),
  analyticsFilterCategoryChips: document.getElementById("analytics-filter-category-chips"),
  analyticsFilterPriority: document.getElementById("analytics-filter-priority"),
  analyticsApplyBtn: document.getElementById("analytics-apply-btn"),
  deviationGroupBy: document.getElementById("deviation-group-by"),
  heatmap: document.getElementById("heatmap"),
  flowMetrics: document.getElementById("flow-metrics"),
  wipChart: document.getElementById("wip-chart"),
  deviationChart: document.getElementById("deviation-chart"),
  deviationChartPriority: document.getElementById("deviation-chart-priority"),
  deviationChartProject: document.getElementById("deviation-chart-project"),
  deviationChartCategory: document.getElementById("deviation-chart-category"),
  deviationChartTask: document.getElementById("deviation-chart-task"),
  deviationLegend: document.getElementById("deviation-legend"),
  calendarWeeks: document.getElementById("calendar-weeks"),
  archiveTableBody: document.getElementById("archive-table-body"),
  archiveTableHead: document.getElementById("archive-table-head"),
  archiveFilterDescription: document.getElementById("archive-filter-description"),
  archiveFilterProject: document.getElementById("archive-filter-project"),
  archiveFilterCategoryChips: document.getElementById("archive-filter-category-chips"),
  archiveFilterPriority: document.getElementById("archive-filter-priority"),
  archiveFilterCompletedFrom: document.getElementById("archive-filter-completed-from"),
  archiveApplyBtn: document.getElementById("archive-apply-btn"),
  archiveResetBtn: document.getElementById("archive-reset-btn"),
  backlogTableBody: document.getElementById("backlog-table-body"),
  backlogTableHead: document.getElementById("backlog-table-head"),
  backlogFilterDescription: document.getElementById("backlog-filter-description"),
  backlogFilterProject: document.getElementById("backlog-filter-project"),
  backlogFilterCategoryChips: document.getElementById("backlog-filter-category-chips"),
  backlogFilterPriority: document.getElementById("backlog-filter-priority"),
  backlogFilterStartDate: document.getElementById("backlog-filter-start-date"),
  backlogFilterAttrKey: document.getElementById("backlog-filter-attr-key"),
  backlogFilterAttrValue: document.getElementById("backlog-filter-attr-value"),
  backlogApplyBtn: document.getElementById("backlog-apply-btn"),
  backlogResetBtn: document.getElementById("backlog-reset-btn"),

  settingsWorkMinutes: document.getElementById("settings-work-minutes"),
  settingsShortBreak: document.getElementById("settings-short-break"),
  settingsLongBreak: document.getElementById("settings-long-break"),
  settingsWorkdayStart: document.getElementById("settings-workday-start"),
  settingsWorkdayEnd: document.getElementById("settings-workday-end"),
  settingsKanbanProcessView: document.getElementById("settings-kanban-process-view"),
  settingsTheme: document.getElementById("settings-theme"),
  settingsLanguage: document.getElementById("settings-language"),
  settingsTickingEnabled: document.getElementById("settings-ticking-enabled"),
  settingsMarkdownExtendedEnabled: document.getElementById("settings-markdown-extended-enabled"),
  saveSettingsBtn: document.getElementById("save-settings-btn"),
  settingsDbProfile: document.getElementById("settings-db-profile"),
  settingsDbCreateBtn: document.getElementById("settings-db-create-btn"),
  settingsDbPickBtn: document.getElementById("settings-db-pick-btn"),
  settingsDbActivateBtn: document.getElementById("settings-db-activate-btn"),
  settingsDbCurrent: document.getElementById("settings-db-current")
};

let markdownRendererConfigured = false;
let systemThemeMediaQuery = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isExtendedMarkdownEnabled() {
  const raw = String(state.settings?.markdownExtendedEnabled ?? "1").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeCodeLanguage(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "plain";
  if (["js", "javascript", "ts", "typescript", "jsx", "tsx", "mjs", "cjs"].includes(raw)) return "javascript";
  if (["json", "jsonc"].includes(raw)) return "json";
  if (["sql", "sqlite", "postgres", "postgresql", "mysql"].includes(raw)) return "sql";
  if (["sh", "bash", "zsh", "shell"].includes(raw)) return "bash";
  if (["md", "markdown"].includes(raw)) return "markdown";
  return raw;
}

function getCodeHighlighter(normalizedLang) {
  if (normalizedLang === "javascript") {
    const keywordSet = new Set([
      "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export",
      "extends", "finally", "for", "function", "if", "import", "in", "instanceof", "let", "new", "return", "super",
      "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "await", "async", "static"
    ]);

    return {
      regex: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null|undefined|NaN|Infinity)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b)/g,
      classify(token) {
        if (token.startsWith("//") || token.startsWith("/*")) return "md-token-comment";
        if (token.startsWith('"') || token.startsWith("'")) return "md-token-string";
        if (/^\d/.test(token)) return "md-token-number";
        if (["true", "false", "null", "undefined", "NaN", "Infinity"].includes(token)) return "md-token-constant";
        if (keywordSet.has(token)) return "md-token-keyword";
        return "md-token-plain";
      }
    };
  }

  if (normalizedLang === "sql") {
    const keywordSet = new Set([
      "select", "from", "where", "and", "or", "join", "left", "right", "inner", "outer", "on", "group", "by", "order",
      "having", "limit", "offset", "insert", "into", "values", "update", "set", "delete", "create", "table", "index",
      "alter", "drop", "primary", "key", "foreign", "references", "not", "null", "default", "as", "distinct", "case",
      "when", "then", "else", "end", "union", "all", "exists", "like", "in", "is", "between"
    ]);

    return {
      regex: /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gi,
      classify(token) {
        const lower = token.toLowerCase();
        if (token.startsWith("--") || token.startsWith("/*")) return "md-token-comment";
        if (token.startsWith("'")) return "md-token-string";
        if (/^\d/.test(token)) return "md-token-number";
        if (keywordSet.has(lower)) return "md-token-keyword";
        return "md-token-plain";
      }
    };
  }

  if (normalizedLang === "bash") {
    const keywordSet = new Set(["if", "then", "else", "fi", "for", "in", "do", "done", "case", "esac", "while", "function", "echo"]);

    return {
      regex: /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$[A-Za-z_][A-Za-z0-9_]*|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm,
      classify(token) {
        if (token.startsWith("#")) return "md-token-comment";
        if (token.startsWith('"') || token.startsWith("'")) return "md-token-string";
        if (token.startsWith("$")) return "md-token-variable";
        if (/^\d/.test(token)) return "md-token-number";
        if (keywordSet.has(token)) return "md-token-keyword";
        return "md-token-plain";
      }
    };
  }

  if (normalizedLang === "json") {
    return {
      regex: /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}[\],:]/g,
      classify(token) {
        if (token.startsWith('"')) return "md-token-string";
        if (/^[-\d]/.test(token)) return "md-token-number";
        if (["true", "false", "null"].includes(token)) return "md-token-constant";
        return "md-token-keyword";
      }
    };
  }

  return null;
}

function highlightCode(code, lang) {
  const raw = String(code ?? "");
  const normalizedLang = normalizeCodeLanguage(lang);
  const highlighter = getCodeHighlighter(normalizedLang);
  if (!highlighter) return escapeHtml(raw);

  let output = "";
  let index = 0;
  const regex = highlighter.regex;
  regex.lastIndex = 0;

  let match = regex.exec(raw);
  while (match) {
    const token = match[0] || "";
    const at = match.index;
    if (at > index) {
      output += escapeHtml(raw.slice(index, at));
    }

    const tokenClass = highlighter.classify(token, match) || "md-token-plain";
    output += `<span class="md-token ${tokenClass}">${escapeHtml(token)}</span>`;
    index = at + token.length;

    if (!token.length) {
      regex.lastIndex += 1;
    }

    match = regex.exec(raw);
  }

  if (index < raw.length) {
    output += escapeHtml(raw.slice(index));
  }

  return output;
}

function sanitizeMarkdownHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html ?? "");

  const allowedTags = new Set([
    "p", "br", "hr", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li",
    "input", "a", "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr", "th", "td",
    "span", "div"
  ]);

  const blockedTags = new Set(["script", "style", "iframe", "object", "embed", "meta", "link", "base", "form", "button", "textarea", "select"]);
  const allowedClassPrefixes = ["md-", "language-", "task-list-item", "contains-task-list", "hljs"];

  function isSafeUrl(value) {
    const href = String(value || "").trim();
    if (!href) return false;
    return /^(https?:|mailto:|#|\/)/i.test(href);
  }

  function cleanElement(element) {
    const tag = element.tagName.toLowerCase();

    if (blockedTags.has(tag)) {
      element.remove();
      return;
    }

    for (const child of [...element.children]) {
      cleanElement(child);
    }

    if (!allowedTags.has(tag)) {
      const fragment = document.createDocumentFragment();
      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }
      element.replaceWith(fragment);
      return;
    }

    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on") || name === "style") {
        element.removeAttribute(attr.name);
        continue;
      }

      if (name === "class") {
        const safe = value
          .split(/\s+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .filter((x) => allowedClassPrefixes.some((prefix) => x === prefix || x.startsWith(prefix)));
        if (safe.length) {
          element.setAttribute("class", safe.join(" "));
        } else {
          element.removeAttribute("class");
        }
        continue;
      }

      if (tag === "a" && ["href", "title", "target", "rel"].includes(name)) {
        continue;
      }

      if (tag === "input" && ["type", "checked", "disabled"].includes(name)) {
        continue;
      }

      if (["th", "td"].includes(tag) && ["colspan", "rowspan", "align"].includes(name)) {
        continue;
      }

      element.removeAttribute(attr.name);
    }

    if (tag === "a") {
      const href = element.getAttribute("href");
      if (!isSafeUrl(href)) {
        element.removeAttribute("href");
      } else if (/^https?:/i.test(String(href))) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }

    if (tag === "input") {
      const type = String(element.getAttribute("type") || "").toLowerCase();
      if (type !== "checkbox") {
        element.replaceWith(document.createTextNode(""));
        return;
      }
      element.setAttribute("disabled", "disabled");
      if (!element.hasAttribute("checked")) {
        element.removeAttribute("checked");
      }
    }
  }

  for (const child of [...template.content.children]) {
    cleanElement(child);
  }

  return template.innerHTML;
}

function ensureExtendedMarkdownRenderer() {
  if (markdownRendererConfigured) return;

  const renderer = new marked.Renderer();
  renderer.code = (token) => {
    const text = typeof token === "string" ? token : (token?.text ?? "");
    const langRaw = typeof token === "string" ? "" : (token?.lang ?? "");
    const lang = normalizeCodeLanguage(langRaw);
    const code = highlightCode(text, lang);
    return `<pre class="md-code-block"><code class="md-code md-lang-${escapeHtml(lang)}">${code}</code></pre>`;
  };
  renderer.table = (token) => {
    const aligns = Array.isArray(token?.align) ? token.align : [];
    const headerCells = Array.isArray(token?.header) ? token.header : [];
    const bodyRows = Array.isArray(token?.rows) ? token.rows : [];

    const renderCell = (cell, index, tagName) => {
      const align = String(aligns[index] || "").toLowerCase();
      const alignAttr = ["left", "center", "right"].includes(align) ? ` align="${align}"` : "";
      const text = escapeHtml(String(cell?.text || ""));
      return `<${tagName}${alignAttr}>${text}</${tagName}>`;
    };

    const headerHtml = `<thead><tr>${headerCells.map((cell, index) => renderCell(cell, index, "th")).join("")}</tr></thead>`;
    const bodyHtml = `<tbody>${bodyRows.map((row) => `<tr>${(Array.isArray(row) ? row : []).map((cell, index) => renderCell(cell, index, "td")).join("")}</tr>`).join("")}</tbody>`;

    return `<div class="md-table-wrap"><table>${headerHtml}${bodyHtml}</table></div>`;
  };

  marked.setOptions({
    gfm: true,
    breaks: true,
    renderer,
    mangle: false,
    headerIds: false
  });

  markdownRendererConfigured = true;
}

function simpleMarkdown(text) {
  const input = String(text ?? "");

  if (!isExtendedMarkdownEnabled()) {
    return escapeHtml(input).replaceAll("\n", "<br />");
  }

  ensureExtendedMarkdownRenderer();
  const rendered = marked.parse(input, { gfm: true, breaks: true });
  return sanitizeMarkdownHtml(typeof rendered === "string" ? rendered : String(rendered ?? ""));
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(LOCALE_BY_LANGUAGE[state.language] || "en-US");
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(LOCALE_BY_LANGUAGE[state.language] || "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isoToLocalDateTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return y + "-" + m + "-" + day + "T" + hh + ":" + mm;
}

function localDateTimeInputToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatMinutes(sec) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function monthAbbr(date) {
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[state.language] || "en-US", {
    month: "short"
  }).format(date);
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function parseTimeToMinutes(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function normalizeTimeValue(value, fallback) {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return fallback;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatMinutesAsTime(totalMinutes) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Number(totalMinutes) || 0));
  const hh = String(Math.floor(safe / 60)).padStart(2, "0");
  const mm = String(safe % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getKanbanProcessViewMode() {
  return String(state.settings?.kanbanProcessView || "") === "process" ? "process" : "today";
}

function dateKeyLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCalendarBaseMonday() {
  const thisMonday = getMonday(new Date());
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  return prevMonday;
}

function getCalendarRangeIso() {
  const start = getCalendarBaseMonday();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 21);
  end.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString(), start, end };
}

function parseAttributesText(text) {
  const out = {};
  String(text || "")
    .split(/\n|,/) 
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(":");
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) out[key] = value;
    });
  return out;
}

function attributesToText(attrs) {
  return Object.entries(attrs || {})
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");
}

function showToast(message, ms = 2600) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  setTimeout(() => {
    els.toast.classList.add("hidden");
  }, ms);
}

function t(key) {
  return I18N[state.language]?.[key] || I18N.ru[key] || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute("placeholder", t(key));
  });

  renderDeviationGroupByOptions();
}

function renderDeviationGroupByOptions() {
  if (!els.deviationGroupBy) return;
  const options = [
    { value: "task", label: t("groupByTask") },
    { value: "project", label: t("groupByProject") },
    { value: "category", label: t("groupByCategory") },
    { value: "priority", label: t("groupByPriority") }
  ];
  els.deviationGroupBy.innerHTML = options
    .map((item) => {
      const selected = item.value === state.analyticsDeviationGroupBy ? "selected" : "";
      return `<option value="${item.value}" ${selected}>${escapeHtml(item.label)}</option>`;
    })
    .join("");
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const mode = theme === "system" ? "system" : (theme === "dark" ? "dark" : "light");
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.body.dataset.theme = resolved;
  document.body.dataset.themeMode = mode;
}

function bindSystemThemeListener() {
  if (!window.matchMedia) return;
  if (systemThemeMediaQuery) return;

  systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if ((state.settings.theme || "light") === "system") {
      applyTheme("system");
    }
  };

  if (typeof systemThemeMediaQuery.addEventListener === "function") {
    systemThemeMediaQuery.addEventListener("change", onChange);
  } else if (typeof systemThemeMediaQuery.addListener === "function") {
    systemThemeMediaQuery.addListener(onChange);
  }
}

function setActiveTab(tab) {
  if (tab === "pomodoro" && !hasActivePomodoroTask() && !state.timer.running) {
    tab = "kanban";
  }

  els.tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  els.tabContents.forEach((section) => {
    section.classList.toggle("active", section.id === `tab-${tab}`);
  });

  if (tab === "analytics") {
    void loadAnalytics();
  }
  if (tab === "calendar") {
    void loadCalendar();
  }
  if (tab === "backlog") {
    void loadBacklog();
  }
  if (tab === "archive") {
    void loadArchive();
  }
  if (tab !== "backlog") {
    closeBacklogTaskMenu();
    closeBacklogMoveMenu();
  }
  if (tab !== "archive") {
    closeArchiveTaskMenu();
  }
}

function syncPomodoroTabVisibility() {
  if (!els.pomodoroTabBtn) return;

  const hasActive = hasActivePomodoroTask() || state.timer.running;
  els.pomodoroTabBtn.classList.toggle("hidden", !hasActive);

  if (!hasActive) {
    const pomodoroTab = document.getElementById("tab-pomodoro");
    const isPomodoroActive = pomodoroTab?.classList.contains("active");

    if (state.timer.running) {
      stopTimerInterval();
      state.timer.running = false;
      state.timer.kind = "work";
      state.timer.sessionStartedAt = null;
      state.timer.taskId = null;
      state.timer.remainingSec = timerDefaultDuration("work");
      state.timer.plannedDurationSec = state.timer.remainingSec;
      pushTimerRuntimeState();
    }

    if (isPomodoroActive) {
      setActiveTab("kanban");
    }
  }
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove("hidden");
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
}

function isTaskRunning(taskId) {
  return (
    state.timer.running
    && state.timer.kind === "work"
    && Number(state.board?.activeTask?.id || 0) === Number(taskId)
  );
}

function getColumnByTitle(title) {
  return (state.board?.columns || []).find((column) => column.title === title) || null;
}

function hasActivePomodoroTask() {
  const processColumn = getColumnByTitle("Process");
  const activeTask = state.board?.activeTask;
  return Boolean(
    processColumn
    && activeTask
    && Number(activeTask.column_id) === Number(processColumn.id)
  );
}

function getPomodoroTargetTask() {
  const processColumn = getColumnByTitle("Process");
  const processTasks = Array.isArray(processColumn?.tasks) ? processColumn.tasks : [];
  const activeTask = state.board?.activeTask || null;

  if (activeTask && processColumn && Number(activeTask.column_id) === Number(processColumn.id)) {
    return activeTask;
  }

  return processTasks[0] || null;
}

async function moveTaskToWait(taskId) {
  const waitColumn = getColumnByTitle("Wait");
  if (!waitColumn || !taskId) return;
  const task = findTask(taskId);
  if (task && Number(task.column_id) === Number(waitColumn.id)) return;
  await api.moveTask(Number(taskId), Number(waitColumn.id));
}

async function interruptTaskFlow(taskId, options = {}) {
  const numericTaskId = Number(taskId || 0);
  if (!numericTaskId) return;

  const runningTaskId = Number(state.timer.taskId || state.board?.activeTask?.id || 0);
  const isRunningWorkTask = state.timer.running
    && state.timer.kind === "work"
    && runningTaskId === numericTaskId;

  if (isRunningWorkTask) {
    await finishCurrentSession(true, { moveToWait: options.moveToWait !== false });
  } else {
    await api.interruptTask(numericTaskId);
    if (options.moveToWait !== false) {
      await moveTaskToWait(numericTaskId);
    }
  }
}

async function recoverInterruptedPomodoroAfterCrash() {
  if (typeof api.getStartupState !== "function") return;

  const startup = await api.getStartupState();
  if (!startup?.wasUncleanShutdown) return;

  const processColumn = getColumnByTitle("Process");
  const activeTask = state.board?.activeTask;
  const isActiveInProcess = Boolean(
    processColumn
    && activeTask
    && Number(activeTask.column_id) === Number(processColumn.id)
  );

  if (!isActiveInProcess || !activeTask?.id) return;

  const runtime = startup?.timerRuntime || null;
  const runtimeRunning = Boolean(runtime?.running);
  const runtimeKind = runtime?.kind === "break" ? "break" : "work";
  const runtimeTaskId = Number(runtime?.taskId || 0) || null;
  const runtimeStartedAt = runtime?.sessionStartedAt ? String(runtime.sessionStartedAt) : null;
  const runtimePlannedSec = Math.max(1, Number(runtime?.plannedDurationSec || timerDefaultDuration("work")));
  const startedMs = runtimeStartedAt ? new Date(runtimeStartedAt).getTime() : NaN;

  if (!runtimeRunning || runtimeKind !== "work" || !Number.isFinite(startedMs)) {
    return;
  }
  if (runtimeTaskId && runtimeTaskId !== Number(activeTask.id)) {
    return;
  }

  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  const remainingSec = runtimePlannedSec - elapsedSec;

  if (remainingSec > 0) {
    state.timer.kind = "work";
    state.timer.taskId = Number(activeTask.id);
    state.timer.running = false;
    state.timer.sessionStartedAt = runtimeStartedAt;
    state.timer.plannedDurationSec = runtimePlannedSec;
    state.timer.remainingSec = remainingSec;
    startTimerTick({ resume: true, keepCurrentTab: true });
    showToast(
      state.language === "ru"
        ? "Помидор восстановлен после перезапуска"
        : "Pomodoro resumed after restart"
    );
    return;
  }

  await api.interruptTask(activeTask.id);
  await moveTaskToWait(activeTask.id);
  state.timer.running = false;
  state.timer.kind = "work";
  state.timer.taskId = null;
  state.timer.sessionStartedAt = null;
  state.timer.remainingSec = timerDefaultDuration("work");
  state.timer.plannedDurationSec = state.timer.remainingSec;
  pushTimerRuntimeState();
  await refreshBoard();
}

function closeTaskContextMenu() {
  state.contextMenuTaskId = null;
  state.contextMenuMode = "default";
  els.taskContextMenu.classList.add("hidden");
}

function closeBacklogTaskMenu() {
  if (!els.backlogTaskMenu) return;
  els.backlogTaskMenu.classList.add("hidden");
  if (els.backlogMenuMoveList) {
    els.backlogMenuMoveList.innerHTML = "";
  }
  delete els.backlogTaskMenu.dataset.taskId;
  state.backlogMenuTaskId = null;
}

function closeBacklogMoveMenu() {
  if (!els.backlogMoveMenu) return;
  els.backlogMoveMenu.classList.add("hidden");
  els.backlogMoveMenu.innerHTML = "";
  delete els.backlogMoveMenu.dataset.taskId;
}

function closeArchiveTaskMenu() {
  if (!els.archiveTaskMenu) return;
  els.archiveTaskMenu.classList.add("hidden");
  delete els.archiveTaskMenu.dataset.archiveId;
  state.archiveMenuRowId = null;
}

function closeArchiveTaskViewModal() {
  if (!els.archiveTaskViewModal) return;
  els.archiveTaskViewModal.classList.add("hidden");
  if (els.archiveViewCloneBtn) {
    delete els.archiveViewCloneBtn.dataset.archiveId;
  }
}

async function openArchiveTaskViewModal(archiveRow) {
  const row = archiveRow || null;
  if (!row) return;

  const task = await api.getTask(Number(row.task_id || 0));
  const attrs = task?.attributes || {};
  const attrRows = Object.entries(attrs);

  const categories = Array.isArray(task?.category_names) && task.category_names.length
    ? task.category_names
    : String(row.category_name || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const dateLines = [
    t("scheduledAt") + ": " + (formatDateTime(task?.scheduled_at || row.scheduled_at) || "-"),
    t("archiveDateStart") + ": " + (formatDate(task?.start_date || row.start_date) || "-"),
    t("archiveDateEnd") + ": " + (formatDate(task?.end_date || row.end_date) || "-"),
    t("archiveDateCompleted") + ": " + (formatDate(row.completed_at) || "-"),
    t("archiveDateArchived") + ": " + (formatDate(row.archived_at) || "-")
  ];

  if (els.archiveViewId) els.archiveViewId.textContent = String(row.task_id || row.id || "");
  if (els.archiveViewSubject) els.archiveViewSubject.textContent = String(row.subject || task?.subject || "");
  if (els.archiveViewDescription) {
    els.archiveViewDescription.innerHTML = simpleMarkdown(row.description_md || task?.description_md || "");
  }
  if (els.archiveViewProject) {
    els.archiveViewProject.textContent = String(task?.project_name || row.project_name || t("noData"));
  }
  if (els.archiveViewCategories) {
    els.archiveViewCategories.textContent = categories.length ? categories.join(", ") : t("noData");
  }
  if (els.archiveViewPlanned) els.archiveViewPlanned.textContent = String(row.planned_pomodoros || task?.planned_pomodoros || 0);
  if (els.archiveViewSpent) els.archiveViewSpent.textContent = String(row.spent_pomodoros || task?.spent_pomodoros || 0);
  if (els.archiveViewPomodorosCount) {
    els.archiveViewPomodorosCount.textContent = String(row.spent_pomodoros || task?.spent_pomodoros || 0);
  }
  if (els.archiveViewDates) {
    els.archiveViewDates.innerHTML = dateLines.map((line) => "<div>" + escapeHtml(line) + "</div>").join("");
  }
  if (els.archiveViewAttributes) {
    if (attrRows.length) {
      const items = attrRows
        .map(([key, value]) => "<li><strong>" + escapeHtml(key) + ":</strong> " + escapeHtml(value) + "</li>")
        .join("");
      els.archiveViewAttributes.innerHTML = "<ul>" + items + "</ul>";
    } else {
      els.archiveViewAttributes.innerHTML = "<span>" + escapeHtml(t("noData")) + "</span>";
    }
  }

  if (els.archiveViewCloneBtn) {
    els.archiveViewCloneBtn.dataset.archiveId = String(row.id);
  }

  openModal(els.archiveTaskViewModal);
}

function openBacklogTaskMenu(taskId, x, y) {
  const id = Number(taskId || 0);
  if (!id) return;

  closeBacklogMoveMenu();
  state.backlogMenuTaskId = id;
  els.backlogMenuEditBtn.textContent = t("backlogEdit");
  els.backlogMenuDeleteBtn.textContent = t("backlogDelete");

  const columns = getBacklogTargetColumns();
  if (els.backlogMenuMoveList) {
    els.backlogMenuMoveList.innerHTML = columns
      .map((column) => `<button type="button" data-column-id="${column.id}">${escapeHtml(column.title)}</button>`)
      .join("");
  }

  const menuWidth = 220;
  const approxButtonHeight = 36;
  const staticButtonsCount = 2;
  const menuHeight = Math.min(420, (columns.length + staticButtonsCount) * approxButtonHeight + 8);
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));
  els.backlogTaskMenu.style.left = `${left}px`;
  els.backlogTaskMenu.style.top = `${top}px`;
  els.backlogTaskMenu.dataset.taskId = String(id);
  els.backlogTaskMenu.classList.remove("hidden");
}

function openArchiveTaskMenu(archiveId, x, y) {
  state.archiveMenuRowId = Number(archiveId || 0);
  closeBacklogTaskMenu();
  els.archiveMenuViewBtn.textContent = t("viewTask");
  els.archiveMenuCreateBtn.textContent = t("cloneToInbox");
  els.archiveMenuDeleteBtn.textContent = t("deleteFromArchive");

  const menuWidth = 240;
  const menuHeight = 126;
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));
  els.archiveTaskMenu.style.left = `${left}px`;
  els.archiveTaskMenu.style.top = `${top}px`;
  els.archiveTaskMenu.dataset.archiveId = String(archiveId);
  els.archiveTaskMenu.classList.remove("hidden");
}

function getSortIndicator(sortState, key) {
  if (sortState.key !== key) return "";
  return sortState.dir === "asc" ? " ▲" : " ▼";
}

function applyTableSort(rows, sortState) {
  const sorted = [...(rows || [])];
  const dirMul = sortState.dir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    const av = a?.[sortState.key];
    const bv = b?.[sortState.key];
    const aNum = Number(av);
    const bNum = Number(bv);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return (aNum - bNum) * dirMul;
    }
    const aStr = String(av ?? "").toLowerCase();
    const bStr = String(bv ?? "").toLowerCase();
    if (aStr < bStr) return -1 * dirMul;
    if (aStr > bStr) return 1 * dirMul;
    return 0;
  });
  return sorted;
}

function openTaskContextMenu(taskId, x, y) {
  state.contextMenuTaskId = Number(taskId);
  state.contextMenuMode = "default";
  const running = isTaskRunning(taskId);
  const task = findTask(taskId);
  const sourceColumn = (state.board?.columns || []).find((column) => Number(column.id) === Number(task?.column_id));
  const canAddToBacklog = !!sourceColumn && sourceColumn.title !== "Process" && sourceColumn.title !== "Done";
  const isDoneColumn = sourceColumn?.title === "Done";
  const canMoveToWait = !!sourceColumn && sourceColumn.title !== "Wait";
  const canMoveToDone = !!sourceColumn && sourceColumn.title !== "Done";

  els.contextStartStopBtn.textContent = running
    ? (state.language === "ru" ? "Прервать" : "Interrupt")
    : (state.language === "ru" ? "Старт" : "Start");
  els.contextStartStopBtn.classList.toggle("hidden", isDoneColumn);
  els.contextEditBtn.textContent = state.language === "ru" ? "Редактировать" : "Edit";
  els.contextWaitBtn.textContent = state.language === "ru" ? "Ожидание" : "Wait";
  els.contextWaitBtn.classList.toggle("hidden", !canMoveToWait);
  els.contextDoneBtn.textContent = state.language === "ru" ? "Готово" : "Done";
  els.contextDoneBtn.classList.toggle("hidden", !canMoveToDone);
  els.contextCloneBtn.textContent = state.language === "ru" ? "Клонировать" : "Clone";
  els.contextCloneBtn.classList.toggle("hidden", !isDoneColumn);
  els.contextBacklogBtn.textContent = state.language === "ru" ? "В Бэклог" : "To Backlog";
  els.contextBacklogBtn.classList.toggle("hidden", !canAddToBacklog);
  els.contextDeleteBtn.textContent = state.language === "ru" ? "Удалить" : "Delete";
  els.contextStartStopBtn.dataset.mode = running ? "stop" : "start";
  els.contextEditBtn.dataset.mode = "edit";

  const menuWidth = 190;
  const visibleButtons = Array.from(els.taskContextMenu.querySelectorAll("button"))
    .filter((button) => !button.classList.contains("hidden"));
  const menuHeight = Math.min(420, visibleButtons.length * 34 + 8);
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  els.taskContextMenu.style.left = `${left}px`;
  els.taskContextMenu.style.top = `${top}px`;
  els.taskContextMenu.classList.remove("hidden");
}

function openTodayTaskContextMenu(taskId, x, y, menuMode) {
  state.contextMenuTaskId = Number(taskId);
  state.contextMenuMode = String(menuMode || "today-inactive");
  const isFutureMode = state.contextMenuMode === "today-future";
  const isRunningMode = state.contextMenuMode === "today-running";

  els.contextStartStopBtn.classList.toggle("hidden", isFutureMode || isRunningMode);
  els.contextStartStopBtn.textContent = state.language === "ru" ? "Старт" : "Start";
  els.contextStartStopBtn.dataset.mode = "start";

  els.contextEditBtn.textContent = isFutureMode
    ? (state.language === "ru" ? "Редактировать" : "Edit")
    : (state.language === "ru" ? "Просмотр" : "View");
  els.contextEditBtn.dataset.mode = isFutureMode ? "result-only" : "view";
  els.contextEditBtn.classList.remove("hidden");

  els.contextWaitBtn.classList.add("hidden");
  els.contextDoneBtn.classList.add("hidden");
  els.contextCloneBtn.classList.add("hidden");
  els.contextBacklogBtn.classList.add("hidden");
  els.contextDeleteBtn.textContent = state.language === "ru" ? "Удалить" : "Delete";
  els.contextDeleteBtn.classList.remove("hidden");

  const menuWidth = 190;
  const visibleButtons = Array.from(els.taskContextMenu.querySelectorAll("button"))
    .filter((button) => !button.classList.contains("hidden"));
  const menuHeight = Math.min(420, visibleButtons.length * 34 + 8);
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  els.taskContextMenu.style.left = `${left}px`;
  els.taskContextMenu.style.top = `${top}px`;
  els.taskContextMenu.classList.remove("hidden");
}

function updateHeaderActiveTask() {
  const active = getPomodoroTargetTask() || state.board?.activeTask || null;
  if (!els.headerActiveTask) return;
  if (!active) {
    els.headerActiveTask.textContent = state.language === "ru" ? "Нет активной задачи" : "No active task";
    return;
  }

  const processTarget = getPomodoroTargetTask();
  const timerTaskId = Number(state.timer.taskId || state.board?.activeTask?.id || 0);
  const isRunningTask = Boolean(
    state.timer.running
    && state.timer.kind === "work"
    && processTarget
    && Number(processTarget.id) === Number(active.id)
    && timerTaskId === Number(active.id)
  );

  const plannedSec = Math.max(1, Number(isRunningTask
    ? (state.timer.plannedDurationSec || timerDefaultDuration("work"))
    : timerDefaultDuration("work")));
  const remainingSec = Math.max(0, Number(isRunningTask ? state.timer.remainingSec : plannedSec));
  const remainingPct = Math.max(0, Math.min(100, (remainingSec / plannedSec) * 100));
  const project = active.project_name ? `#${active.project_name}` : "";
  const title = getTaskShortLabel(active);
  const timerLabel = state.language === "ru"
    ? `Осталось: ${formatMinutes(remainingSec)}`
    : `Remaining: ${formatMinutes(remainingSec)}`;
  const statusLabel = isRunningTask
    ? (state.language === "ru" ? "идет помидор" : "running")
    : (state.language === "ru" ? "ожидание запуска" : "idle");

  els.headerActiveTask.innerHTML = `
    <div class="header-task-title-row">
      <div class="header-task-title">${escapeHtml(title)}</div>
      <div class="header-task-timer">${escapeHtml(timerLabel)}</div>
    </div>
    <div class="header-task-subline">
      <span>${escapeHtml(project)}</span>
      <span>${escapeHtml(statusLabel)}</span>
    </div>
    <div class="header-task-gauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(remainingPct)}">
      <div class="header-task-gauge-fill" style="width:${remainingPct}%;"></div>
    </div>
  `;
}

function ensurePomodoroActionButtonsEnabled() {
  if (els.timerStopBtn) {
    els.timerStopBtn.disabled = false;
    els.timerStopBtn.removeAttribute("disabled");
  }
  if (els.timerMarkDoneBtn) {
    els.timerMarkDoneBtn.disabled = false;
    els.timerMarkDoneBtn.removeAttribute("disabled");
  }
}

function normalizeIdArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)));
}

function renderCategoryChips(container, categories, selectedIds) {
  if (!container) return;
  const selected = new Set(normalizeIdArray(selectedIds));
  container.innerHTML = (categories || [])
    .map((category) => {
      const id = Number(category.id || 0);
      const active = selected.has(id) ? "is-selected" : "";
      return `<button type="button" class="chip ${active}" data-category-chip-id="${id}">${escapeHtml(category.name || "")}</button>`;
    })
    .join("");
}

function toggleCategorySelection(key, categoryId) {
  const id = Number(categoryId || 0);
  if (!id) return;

  const map = {
    task: "taskCategoryIds",
    board: "filters",
    analytics: "analyticsFilters",
    backlog: "backlogFilters",
    archive: "archiveFilters"
  };

  if (key === "task") {
    const current = new Set(normalizeIdArray(state.taskCategoryIds || []));
    if (current.has(id)) current.delete(id); else current.add(id);
    state.taskCategoryIds = Array.from(current);
    renderFilterSelects();
    return;
  }

  const bucketKey = map[key];
  if (!bucketKey) return;
  const bucket = state[bucketKey];
  const current = new Set(normalizeIdArray(bucket.categoryIds || []));
  if (current.has(id)) current.delete(id); else current.add(id);
  bucket.categoryIds = Array.from(current);
  renderFilterSelects();
}

function renderFilterSelects() {
  const projects = state.board?.projects || [];
  const categories = state.board?.categories || [];

  populateSelect(
    els.filterProject,
    projects,
    state.filters.projectId,
    state.language === "ru" ? "Любой проект" : "Any project"
  );

  populateSelect(
    els.analyticsFilterProject,
    projects,
    state.analyticsFilters.projectId,
    state.language === "ru" ? "Все проекты" : "All projects"
  );

  populateSelect(
    els.backlogFilterProject,
    projects,
    state.backlogFilters.projectId,
    state.language === "ru" ? "Все проекты" : "All projects"
  );

  populateSelect(
    els.archiveFilterProject,
    projects,
    state.archiveFilters.projectId,
    state.language === "ru" ? "Все проекты" : "All projects"
  );

  renderCategoryChips(els.filterCategoryChips, categories, state.filters.categoryIds);
  renderCategoryChips(els.analyticsFilterCategoryChips, categories, state.analyticsFilters.categoryIds);
  renderCategoryChips(els.backlogFilterCategoryChips, categories, state.backlogFilters.categoryIds);
  renderCategoryChips(els.archiveFilterCategoryChips, categories, state.archiveFilters.categoryIds);
  renderCategoryChips(els.taskCategoryChips, categories, state.taskCategoryIds || []);

  if (els.backlogFilterDescription) els.backlogFilterDescription.value = state.backlogFilters.descriptionFragment || "";
  if (els.backlogFilterPriority) els.backlogFilterPriority.value = state.backlogFilters.priority || "";
  if (els.backlogFilterStartDate) els.backlogFilterStartDate.value = state.backlogFilters.startDateFrom || "";
  if (els.backlogFilterAttrKey) els.backlogFilterAttrKey.value = state.backlogFilters.attributeKey || "";
  if (els.backlogFilterAttrValue) els.backlogFilterAttrValue.value = state.backlogFilters.attributeValue || "";
  if (els.archiveFilterDescription) els.archiveFilterDescription.value = state.archiveFilters.descriptionFragment || "";
  if (els.archiveFilterPriority) els.archiveFilterPriority.value = state.archiveFilters.priority || "";
  if (els.archiveFilterCompletedFrom) els.archiveFilterCompletedFrom.value = state.archiveFilters.completedFrom || "";

  els.projectsList.innerHTML = projects.map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join("");
  if (typeof state.taskEditorEnabled === "boolean") {
    setTaskEditorEnabled(state.taskEditorEnabled);
  }
}

function populateSelect(selectEl, items, selectedValue, placeholderText) {
  const options = [`<option value="">${escapeHtml(placeholderText)}</option>`];
  for (const item of items || []) {
    const selected = String(item.id) === String(selectedValue) ? "selected" : "";
    options.push(`<option value="${item.id}" ${selected}>${escapeHtml(item.name)}</option>`);
  }
  selectEl.innerHTML = options.join("");
}

function getTaskShortLabel(task) {
  if (!task) return "";
  return String(task.subject || "").trim()
    || String(task.description_md || "").trim().split("\n")[0]
    || ("#" + String(task.id || task.task_id || ""));
}

function getTodayExecutionInterval(processColumnId) {
  const processColumn = (state.board?.columns || []).find((c) => Number(c.id) === Number(processColumnId));
  const processTasks = Array.isArray(processColumn?.tasks) ? processColumn.tasks : [];
  if (!processTasks.length) return null;

  const activeTask = state.board?.activeTask || null;
  const runtimeTask = activeTask
    && Number(activeTask.column_id) === Number(processColumnId)
    ? activeTask
    : null;

  const scheduledCandidates = processTasks
    .filter((task) => !!task?.scheduled_at)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const targetTask = runtimeTask || scheduledCandidates[0] || processTasks[0];
  if (!targetTask) return null;

  const runtimeStart = runtimeTask && state.timer.running && state.timer.kind === "work"
    ? state.timer.sessionStartedAt
    : null;
  const fallbackStart = targetTask.scheduled_at || null;
  const startRaw = runtimeStart || fallbackStart;
  const source = runtimeStart ? "runtime" : "scheduled";
  if (!startRaw) return null;

  const startAt = new Date(startRaw);
  if (Number.isNaN(startAt.getTime())) return null;

  const now = new Date();
  const isSameDate = startAt.getFullYear() === now.getFullYear()
    && startAt.getMonth() === now.getMonth()
    && startAt.getDate() === now.getDate();
  if (!isSameDate) return null;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 3600 * 1000;

  const plannedSec = runtimeStart
    ? Math.max(1, Number(state.timer.plannedDurationSec || timerDefaultDuration("work")))
    : Math.max(1, Number(timerDefaultDuration("work")));
  const startMs = startAt.getTime();
  const endMs = startMs + plannedSec * 1000;
  const clippedStart = Math.max(startMs, dayStartMs);
  const clippedEnd = Math.min(endMs, dayEndMs);
  if (clippedEnd <= clippedStart) return null;

  const startMin = Math.max(0, Math.min(24 * 60, Math.floor((clippedStart - dayStartMs) / 60000)));
  const endMin = Math.max(startMin + 1, Math.min(24 * 60, Math.ceil((clippedEnd - dayStartMs) / 60000)));

  return {
    taskId: Number(targetTask.id || 0) || null,
    startMin,
    endMin,
    source,
    subject: getTaskShortLabel(targetTask),
    scheduledAt: targetTask.scheduled_at || null,
    isRunning: Boolean(runtimeStart)
  };
}

function getTodayPlannedIntervals(excludeTaskId = null) {
  const now = new Date();
  const nowMs = now.getTime();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 3600 * 1000;
  const plannedSec = Math.max(1, Number(timerDefaultDuration("work")));
  const plannedMs = plannedSec * 1000;
  const allBoardTasks = (state.board?.columns || []).flatMap((column) => (Array.isArray(column?.tasks) ? column.tasks : []));
  const scheduledFromCalendar = Array.isArray(state.calendarScheduled) ? state.calendarScheduled : [];
  const combined = [...scheduledFromCalendar, ...allBoardTasks];
  const uniqueBySchedule = new Map();

  for (const item of combined) {
    if (!item?.scheduled_at) continue;
    const taskId = Number(item.task_id || item.id || 0) || 0;
    const key = `${taskId}:${String(item.scheduled_at)}`;
    if (!uniqueBySchedule.has(key)) {
      uniqueBySchedule.set(key, item);
    }
  }

  return Array.from(uniqueBySchedule.values())
    .map((item) => {
      const taskId = Number(item.task_id || item.id || 0) || null;
      if (excludeTaskId && taskId && Number(excludeTaskId) === taskId) return null;

      const startMs = new Date(item.scheduled_at).getTime();
      if (!Number.isFinite(startMs)) return null;
      if (startMs < dayStartMs || startMs >= dayEndMs) return null;

      const clippedStart = Math.max(startMs, dayStartMs);
      const clippedEnd = Math.min(startMs + plannedMs, dayEndMs);
      if (clippedEnd <= clippedStart) return null;

      const startMin = Math.max(0, Math.min(24 * 60, Math.floor((clippedStart - dayStartMs) / 60000)));
      const endMin = Math.max(startMin + 1, Math.min(24 * 60, Math.ceil((clippedEnd - dayStartMs) / 60000)));

      return {
        taskId,
        startMin,
        endMin,
        subject: getTaskShortLabel(item),
        scheduledAt: item.scheduled_at || null,
        isFuture: startMs > nowMs
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin);
}

function getTodayViewportMinutes(execution, planned) {
  const configuredStart = parseTimeToMinutes(state.settings?.workdayStart);
  const configuredEnd = parseTimeToMinutes(state.settings?.workdayEnd);
  const intervals = [];
  if (execution) {
    intervals.push({ startMin: execution.startMin, endMin: execution.endMin });
  }
  for (const item of planned || []) {
    intervals.push({ startMin: item.startMin, endMin: item.endMin });
  }

  const firstPomodoroStart = intervals.length
    ? Math.max(0, Math.min(...intervals.map((item) => item.startMin)))
    : null;

  if (configuredStart !== null && configuredEnd !== null && configuredEnd > configuredStart) {
    const startMin = firstPomodoroStart !== null
      ? Math.min(configuredStart, firstPomodoroStart)
      : configuredStart;
    return { startMin, endMin: configuredEnd };
  }

  if (intervals.length) {
    const minStart = Math.max(0, Math.min(...intervals.map((item) => item.startMin)));
    const maxEnd = Math.min(24 * 60, Math.max(...intervals.map((item) => item.endMin)));
    const safeEnd = Math.max(minStart + 60, maxEnd);
    return { startMin: minStart, endMin: safeEnd };
  }

  const fallbackStart = configuredStart !== null ? configuredStart : 9 * 60;
  const fallbackEnd = configuredEnd !== null ? configuredEnd : 18 * 60;
  return {
    startMin: Math.max(0, Math.min(24 * 60 - 1, fallbackStart)),
    endMin: Math.max(Math.max(0, Math.min(24 * 60 - 1, fallbackStart)) + 60, Math.min(24 * 60, fallbackEnd))
  };
}

function renderTodayColumn(column) {
  const execution = getTodayExecutionInterval(column.id);
  const planned = getTodayPlannedIntervals(execution?.taskId || null);
  const viewport = getTodayViewportMinutes(execution, planned);
  const viewStartMin = viewport.startMin;
  const viewEndMin = viewport.endMin;
  const slotCount = Math.max(1, Math.ceil((viewEndMin - viewStartMin) / 30));
  const plannedActiveSlots = new Set();
  const plannedItemsByStart = new Map();

  for (const item of planned) {
    const clippedStart = Math.max(item.startMin, viewStartMin);
    const clippedEnd = Math.min(item.endMin, viewEndMin);
    if (clippedEnd <= clippedStart) continue;
    const startSlot = Math.max(0, Math.floor((clippedStart - viewStartMin) / 30));
    const endSlot = Math.max(startSlot, Math.ceil((clippedEnd - viewStartMin) / 30) - 1);
    for (let slot = startSlot; slot <= endSlot; slot += 1) {
      plannedActiveSlots.add(slot);
    }
    const list = plannedItemsByStart.get(startSlot) || [];
    list.push(item);
    plannedItemsByStart.set(startSlot, list);
  }

  let executionStartSlot = -1;
  let executionEndSlot = -1;
  if (execution) {
    const clippedStart = Math.max(execution.startMin, viewStartMin);
    const clippedEnd = Math.min(execution.endMin, viewEndMin);
    if (clippedEnd > clippedStart) {
      executionStartSlot = Math.max(0, Math.floor((clippedStart - viewStartMin) / 30));
      executionEndSlot = Math.max(executionStartSlot, Math.ceil((clippedEnd - viewStartMin) / 30) - 1);
    }
  }

  const now = new Date();
  const slots = Array.from({ length: slotCount }, (_unused, index) => {
    const executionActive = executionStartSlot >= 0 && index >= executionStartSlot && index <= executionEndSlot;
    const plannedActive = plannedActiveSlots.has(index);
    const marker = index === 0 || index % 2 === 0
      ? `<span class="today-slot-label">${formatMinutesAsTime(viewStartMin + index * 30)}</span>`
      : "";

    const classes = [];
    if (plannedActive) classes.push("is-scheduled");
    if (executionActive) {
      classes.push(execution.source === "scheduled" ? "is-active-recovered" : "is-active-runtime");
    }

    let taskTitle = "";
    if (executionActive && execution && index === executionStartSlot) {
      const menuMode = execution.isRunning ? "today-running" : "today-inactive";
      taskTitle = `<button type="button" class="today-task-entry today-task-title ${execution.source === "scheduled" ? "is-recovered" : "is-runtime"}" data-task-id="${Number(execution.taskId || 0)}" data-menu-mode="${menuMode}">${escapeHtml(execution.subject)}</button>`;
    } else if (!executionActive) {
      const plannedItems = plannedItemsByStart.get(index) || [];
      if (plannedItems.length) {
        taskTitle = plannedItems
          .map((item) => {
            const menuMode = item.isFuture ? "today-future" : "today-inactive";
            return `<button type="button" class="today-task-entry today-task-title is-scheduled" data-task-id="${Number(item.taskId || 0)}" data-menu-mode="${menuMode}">${escapeHtml(item.subject)}</button>`;
          })
          .join("");
      }
    }

    return `<div class="today-slot ${classes.join(" ")}" data-slot-index="${index}">${marker}${taskTitle}</div>`;
  }).join("");

  return `
    <article class="kanban-column today-column" data-column-id="${column.id}">
      <div class="column-head">
        <h3>${escapeHtml(state.language === "ru" ? "Сегодня" : "Today")} ${escapeHtml(formatMinutesAsTime(viewStartMin))}-${escapeHtml(formatMinutesAsTime(viewEndMin))}</h3>
      </div>
      <div
        class="today-timeline"
        data-view-start="${viewStartMin}"
        data-view-end="${viewEndMin}"
        style="--today-slot-count:${slotCount}"
      >
        <div class="today-now-indicator" style="top:0px">
          <span class="today-now-label">${formatTime(now.toISOString())}</span>
        </div>
        ${slots}
      </div>
    </article>
  `;
}

function updateTodayNowIndicator() {
  const indicators = Array.from(els.board?.querySelectorAll(".today-now-indicator") || []);
  if (!indicators.length) return;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const label = formatTime(now.toISOString());

  indicators.forEach((indicator) => {
    const timeline = indicator.closest(".today-timeline");
    if (!timeline) {
      indicator.style.display = "none";
      return;
    }

    const viewStart = Number(timeline.dataset.viewStart || 0);
    const viewEnd = Number(timeline.dataset.viewEnd || 24 * 60);
    const badge = indicator.querySelector(".today-now-label");
    if (badge) badge.textContent = label;

    const range = viewEnd - viewStart;
    if (!Number.isFinite(range) || range <= 0) {
      indicator.style.display = "none";
      return;
    }
    if (nowMinutes < viewStart || nowMinutes > viewEnd) {
      indicator.style.display = "none";
      return;
    }

    const timelineHeight = Number(timeline.clientHeight || 0);
    if (!Number.isFinite(timelineHeight) || timelineHeight <= 0) {
      indicator.style.display = "none";
      return;
    }

    const progress = (nowMinutes - viewStart) / range;
    const y = Math.max(0, Math.min(timelineHeight, progress * timelineHeight));
    indicator.style.display = "";
    indicator.style.top = `${y}px`;
  });
}

function bindViewportListeners() {
  window.addEventListener("resize", () => {
    updateTodayNowIndicator();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateTodayNowIndicator();
    }
  });
}

function renderBoard() {
  const columns = state.board?.columns || [];
  const processViewMode = getKanbanProcessViewMode();

  els.board.innerHTML = columns
    .map((column) => {
      if (column.title === "Process" && processViewMode === "today") {
        return renderTodayColumn(column);
      }

      const canDelete = column.system ? "" : `<button data-action="delete-column" data-column-id="${column.id}" class="delete-btn">x</button>`;
      const dragHandleTitle =
        state.language === "ru" ? "Перетащите для смены порядка колонки" : "Drag to reorder column";

      return `
        <article class="kanban-column" data-column-id="${column.id}">
          <div class="column-head">
            <h3>${escapeHtml(column.title)} (${column.tasks.length})</h3>
            <div class="column-head-actions">
              <button
                type="button"
                class="column-drag-handle"
                draggable="true"
                data-column-drag-id="${column.id}"
                title="${escapeHtml(dragHandleTitle)}"
              >⋮⋮</button>
              ${canDelete}
            </div>
          </div>
          <div class="card-list" data-column-drop-id="${column.id}">
            ${column.tasks.map(renderTaskCard).join("")}
            <div class="drop-tail" data-column-drop-tail-id="${column.id}"></div>
          </div>
        </article>
      `;
    })
    .join("");

  bindBoardDnD();
  updateTodayNowIndicator();
}

function renderTaskCard(task) {
  const selectedClass = String(task.id) === String(state.selectedTaskId) ? "selected" : "";
  const attrs = Object.entries(task.attributes || {})
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");

  const pomodoroIcon = '<svg class="pomodoro-meta-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Flat pomodoro icon"><title>Flat Pomodoro Icon</title><path d="M256 126c-96 0-174 78-174 174s78 174 174 174 174-78 174-174-78-174-174-174z" fill="#DD5143"/><path d="M316 84 c30-12 58-6 77 12 c-5 20-22 43-49 55 c-25 11-49 9-66-3 c5-24 20-49 38-64z" fill="#21A16D"/><path d="M184 212c20-26 50-42 84-45" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" opacity="0.18"/></svg>';
  const meta = [
    task.project_name ? `<span>${escapeHtml(`#${task.project_name}`)}</span>` : "",
    task.category_name ? `<span>${escapeHtml(`@${task.category_name}`)}</span>` : "",
    task.priority ? `<span>${escapeHtml(`P:${task.priority}`)}</span>` : "",
    task.scheduled_at ? `<span>${escapeHtml(`${t("scheduledAt")}: ${formatDateTime(task.scheduled_at)}`)}</span>` : "",
    task.start_date ? `<span>${escapeHtml(`${state.language === "ru" ? "Старт" : "Start"}: ${task.start_date}`)}</span>` : "",
    task.end_date ? `<span>${escapeHtml(`${state.language === "ru" ? "Финиш" : "End"}: ${task.end_date}`)}</span>` : "",
    `<span class="pomodoro-meta-counter">${pomodoroIcon}<span>${escapeHtml(`${task.spent_pomodoros}/${task.planned_pomodoros}`)}</span></span>`,
    attrs ? `<span>${escapeHtml(attrs)}</span>` : ""
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="task-card ${selectedClass}" draggable="true" data-task-id="${task.id}" style="background:${escapeHtml(task.color)}">
      <div class="task-top">
        <strong>#${task.id}</strong>
        <span>${task.is_completed ? (state.language === "ru" ? "Готово" : "Done") : ""}</span>
      </div>
      <div class="task-subject"><strong>${escapeHtml(task.subject || "")}</strong></div>
      <div class="task-description">${simpleMarkdown(task.description_md)}</div>
      <div class="task-meta">${meta}</div>
    </div>
  `;
}

function bindBoardDnD() {
  const TASK_DND_TYPE = "application/x-kanban-task";
  const TASK_SOURCE_COLUMN_DND_TYPE = "application/x-kanban-task-source-column";
  const COLUMN_DND_TYPE = "application/x-kanban-column";
  let draggedColumnId = null;
  const getDraggedTaskId = (event) =>
    event.dataTransfer?.getData(TASK_DND_TYPE) || event.dataTransfer?.getData("text/plain");
  const getDraggedSourceColumnId = (event) =>
    event.dataTransfer?.getData(TASK_SOURCE_COLUMN_DND_TYPE) || "";
  const isTaskDrag = (event) => {
    const types = Array.from(event.dataTransfer?.types || []);
    if (types.includes(COLUMN_DND_TYPE)) return false;
    return types.includes(TASK_DND_TYPE) || types.includes("text/plain");
  };
  const readColumnTaskOrder = (columnEl) =>
    Array.from(columnEl?.querySelectorAll(".task-card") || []).map((x) => Number(x.dataset.taskId || 0));
  const persistTaskDrop = async (event, toColumnId, orderBuilder) => {
    const taskId = getDraggedTaskId(event);
    const sourceColumnId = Number(getDraggedSourceColumnId(event) || 0);
    const targetColumnId = Number(toColumnId || 0);
    if (!taskId || !targetColumnId) return;

    const numericTaskId = Number(taskId);
    const sourceColumn = (state.board?.columns || []).find((column) => Number(column.id) === sourceColumnId);
    const targetColumn = (state.board?.columns || []).find((column) => Number(column.id) === targetColumnId);
    const draggedTask = findTask(numericTaskId);

    // Tasks can enter Process only via Start action.
    if (targetColumn?.title === "Process" && sourceColumnId !== targetColumnId) {
      showToast(
        state.language === "ru"
          ? "В Процесс можно попасть только через кнопку Старт"
          : "Tasks can enter Process only via Start"
      );
      return;
    }

    // Moving a completed task out of Done creates a new cloned task by confirmation.
    if (
      sourceColumn
      && sourceColumn.title === "Done"
      && sourceColumnId !== targetColumnId
      && draggedTask
      && draggedTask.is_completed
    ) {
      const shouldClone = confirm(
        state.language === "ru"
          ? "Задача завершена. Создать новую задачу-клон без отметки выполнения?"
          : "Task is completed. Create a cloned task without completion mark?"
      );
      if (!shouldClone) return;

      const created = await api.createTask({
        subject: draggedTask.subject || "",
        descriptionMd: draggedTask.description_md,
        color: draggedTask.color,
        priority: draggedTask.priority,
        startDate: draggedTask.start_date,
        endDate: draggedTask.end_date,
        plannedPomodoros: draggedTask.planned_pomodoros,
        spentPomodoros: 0,
        isCompleted: false,
        projectId: draggedTask.project_id,
        categoryIds: normalizeIdArray(draggedTask.category_ids || (draggedTask.category_id ? [draggedTask.category_id] : [])),
        attributes: draggedTask.attributes || {},
        columnId: targetColumnId
      });

      await refreshBoard();

      if (orderBuilder && created?.id) {
        const targetColumnEl = els.board.querySelector(`.kanban-column[data-column-id="${targetColumnId}"]`);
        const targetOrder = orderBuilder(
          readColumnTaskOrder(targetColumnEl).filter((id) => id !== Number(created.id)),
          Number(created.id)
        );
        await api.reorderTasks(targetColumnId, targetOrder);
        await refreshBoard();
      }
      return;
    }

    if (sourceColumnId && sourceColumnId !== targetColumnId) {
      await api.moveTask(numericTaskId, targetColumnId);
    }

    const targetColumnEl = els.board.querySelector(`.kanban-column[data-column-id="${targetColumnId}"]`);
    const sourceColumnEl = sourceColumnId
      ? els.board.querySelector(`.kanban-column[data-column-id="${sourceColumnId}"]`)
      : null;

    const targetOrder = orderBuilder
      ? orderBuilder(readColumnTaskOrder(targetColumnEl).filter((id) => id !== numericTaskId), numericTaskId)
      : [...readColumnTaskOrder(targetColumnEl).filter((id) => id !== numericTaskId), numericTaskId];

    await api.reorderTasks(targetColumnId, targetOrder);

    if (sourceColumnId && sourceColumnId !== targetColumnId && sourceColumnEl) {
      const sourceOrder = readColumnTaskOrder(sourceColumnEl).filter((id) => id !== numericTaskId);
      await api.reorderTasks(sourceColumnId, sourceOrder);
    }

    await refreshBoard();
  };

  const clearColumnDropState = () => {
    els.board.querySelectorAll(".kanban-column").forEach((columnEl) => {
      columnEl.classList.remove("column-drop-left", "column-drop-right", "column-dragging");
    });
  };

  els.board.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const taskId = card.dataset.taskId || "";
      const sourceColumnId = card.closest(".kanban-column")?.dataset.columnId || "";
      event.dataTransfer?.setData(TASK_DND_TYPE, taskId);
      event.dataTransfer?.setData("text/plain", taskId);
      event.dataTransfer?.setData(TASK_SOURCE_COLUMN_DND_TYPE, sourceColumnId);
      event.dataTransfer.effectAllowed = "move";
    });
  });

  els.board.querySelectorAll("[data-column-drop-id]").forEach((dropZone) => {
    dropZone.addEventListener("dragover", (event) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      const toColumnId = dropZone.dataset.columnDropId;
      try {
        await persistTaskDrop(event, toColumnId);
      } catch (error) {
        showToast(error.message);
      }
    });
  });
  els.board.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragover", (event) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", async (event) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      const columnEl = card.closest(".kanban-column");
      const toColumnId = columnEl?.dataset.columnId;
      const targetCardId = Number(card.dataset.taskId || 0);
      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      try {
        await persistTaskDrop(event, toColumnId, (baseOrder, draggedTaskId) => {
          const withTarget = [...baseOrder];
          const idx = withTarget.indexOf(targetCardId);
          const insertAt = idx < 0 ? withTarget.length : (before ? idx : idx + 1);
          withTarget.splice(insertAt, 0, draggedTaskId);
          return withTarget;
        });
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  els.board.querySelectorAll("[data-column-drop-tail-id]").forEach((tail) => {
    tail.addEventListener("dragover", (event) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tail.addEventListener("drop", async (event) => {
      if (!isTaskDrag(event)) return;
      event.preventDefault();
      const toColumnId = tail.dataset.columnDropTailId;
      try {
        await persistTaskDrop(event, toColumnId, (baseOrder, draggedTaskId) => [
          ...baseOrder,
          draggedTaskId
        ]);
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  els.board.querySelectorAll("[data-column-drag-id]").forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      const columnId = handle.dataset.columnDragId;
      if (!columnId) return;
      draggedColumnId = columnId;
      event.dataTransfer?.setData(COLUMN_DND_TYPE, columnId);
      event.dataTransfer.effectAllowed = "move";

      const columnEl = handle.closest(".kanban-column");
      columnEl?.classList.add("column-dragging");
    });

    handle.addEventListener("dragend", () => {
      draggedColumnId = null;
      clearColumnDropState();
    });
  });

  els.board.querySelectorAll(".kanban-column").forEach((columnEl) => {
    columnEl.addEventListener("dragover", (event) => {
      const sourceColumnId = event.dataTransfer?.getData(COLUMN_DND_TYPE) || draggedColumnId;
      if (!sourceColumnId) return;
      event.preventDefault();

      clearColumnDropState();
      const rect = columnEl.getBoundingClientRect();
      const shouldInsertBefore = event.clientX < rect.left + rect.width / 2;
      columnEl.classList.add(shouldInsertBefore ? "column-drop-left" : "column-drop-right");
    });

    columnEl.addEventListener("drop", async (event) => {
      const sourceColumnId = event.dataTransfer?.getData(COLUMN_DND_TYPE) || draggedColumnId;
      if (!sourceColumnId) return;

      event.preventDefault();
      const sourceColumnEl = els.board.querySelector(
        `.kanban-column[data-column-id="${sourceColumnId}"]`
      );

      if (!sourceColumnEl || sourceColumnEl === columnEl) {
        clearColumnDropState();
        return;
      }

      const rect = columnEl.getBoundingClientRect();
      const shouldInsertBefore = event.clientX < rect.left + rect.width / 2;
      if (shouldInsertBefore) {
        els.board.insertBefore(sourceColumnEl, columnEl);
      } else {
        els.board.insertBefore(sourceColumnEl, columnEl.nextSibling);
      }

      clearColumnDropState();
      draggedColumnId = null;

      const orderedIds = Array.from(els.board.querySelectorAll(".kanban-column")).map((el) =>
        Number(el.dataset.columnId)
      );

      try {
        await api.reorderColumns(orderedIds);
        await refreshBoard();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

function findTask(taskId) {
  const id = Number(taskId);
  for (const column of state.board?.columns || []) {
    const task = column.tasks.find((x) => x.id === id);
    if (task) return task;
  }
  return null;
}

function setTaskColor(color) {
  const normalized = String(color || "").trim().toLowerCase();
  const value = CARD_COLOR_PRESETS.includes(normalized) ? normalized : CARD_COLOR_PRESETS[0];
  els.taskColor.value = value;
  if (els.taskColorPreview) {
    els.taskColorPreview.style.background = value;
  }
  if (els.taskColorValue) {
    els.taskColorValue.textContent = value;
  }
  els.taskColorPalette?.querySelectorAll(".task-color-swatch").forEach((btn) => {
    btn.classList.toggle("active", String(btn.dataset.color || "").toLowerCase() === value);
  });
}

function renderTaskColorPalette() {
  if (!els.taskColorPalette) return;
  els.taskColorPalette.innerHTML = CARD_COLOR_PRESETS
    .map((color) => (
      `<button type="button" class="task-color-swatch" data-color="${color}" style="background:${color}" title="${color}"></button>`
    ))
    .join("");

  setTaskColor(els.taskColor?.value || CARD_COLOR_PRESETS[0]);
}

function clearTaskForm() {
  state.selectedTaskId = null;
  state.taskCategoryIds = [];
  els.taskId.value = "";
  els.taskSubject.value = "";
  if (els.taskResult) els.taskResult.value = "";
  els.taskDescription.value = "";
  els.taskProject.value = "";
  els.taskPriority.value = "";
  els.taskStartDate.value = "";
  els.taskEndDate.value = "";
  if (els.taskScheduledAt) els.taskScheduledAt.value = "";
  els.taskPlanned.value = "1";
  els.taskSpent.value = "0";
  setTaskColor(CARD_COLOR_PRESETS[0]);
  els.taskAttributes.value = "";
  renderFilterSelects();

  state.taskEditorResultOnly = false;
  setTaskEditorEnabled(false);
}

function getBacklogTargetColumns() {
  return (state.board?.columns || []).filter((column) => {
    const title = String(column.title || "").toLowerCase();
    return title !== "process" && title !== "progress" && title !== "done";
  });
}

function openBacklogMoveMenu(taskId, x, y) {
  const columns = getBacklogTargetColumns();
  if (!columns.length) {
    showToast(state.language === "ru" ? "Нет доступных колонок для переноса" : "No available columns to move");
    return;
  }

  els.backlogMoveMenu.innerHTML = columns
    .map((column) => `<button type="button" data-column-id="${column.id}">${escapeHtml(column.title)}</button>`)
    .join("");
  closeBacklogTaskMenu();
  els.backlogMoveMenu.dataset.taskId = String(taskId);

  const menuWidth = 220;
  const approxButtonHeight = 36;
  const menuHeight = Math.min(360, columns.length * approxButtonHeight + 8);
  const left = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));
  els.backlogMoveMenu.style.left = `${left}px`;
  els.backlogMoveMenu.style.top = `${top}px`;
  els.backlogMoveMenu.classList.remove("hidden");
}

function fillTaskForm(task) {
  if (!task) return;
  state.taskEditorResultOnly = false;
  setTaskEditorEnabled(true);
  state.selectedTaskId = task.id;
  state.taskCategoryIds = normalizeIdArray(task.category_ids || (task.category_id ? [task.category_id] : []));
  els.taskId.value = String(task.id);
  els.taskSubject.value = task.subject || "";
  if (els.taskResult) els.taskResult.value = task.result || "";
  els.taskDescription.value = task.description_md || "";
  els.taskProject.value = task.project_name || "";
  els.taskPriority.value = task.priority || "";
  els.taskStartDate.value = task.start_date || "";
  els.taskEndDate.value = task.end_date || "";
  if (els.taskScheduledAt) els.taskScheduledAt.value = isoToLocalDateTimeInput(task.scheduled_at || "");
  els.taskPlanned.value = String(task.planned_pomodoros || 0);
  els.taskSpent.value = String(task.spent_pomodoros || 0);
  setTaskColor(task.color || CARD_COLOR_PRESETS[0]);
  els.taskAttributes.value = attributesToText(task.attributes || {});
  renderFilterSelects();

}

function setTaskEditorResultOnlyMode(enabled) {
  state.taskEditorResultOnly = !!enabled;
  if (!state.taskEditorResultOnly) return;

  setTaskEditorEnabled(true);
  const controls = els.taskForm.querySelectorAll("textarea, input, select, button[type='submit'], .task-color-swatch, .chip");
  controls.forEach((control) => {
    const id = String(control.id || "");
    const isSubmit = typeof control.matches === "function" && control.matches("button[type='submit']");
    const allowed = id === "task-id" || id === "task-result" || isSubmit;
    control.disabled = !allowed;
  });

  if (els.taskEditorHint) {
    els.taskEditorHint.textContent = state.language === "ru"
      ? "Разрешено редактирование только поля Результат."
      : "Only Result field is editable.";
  }
}

function setTaskEditorEnabled(enabled) {
  state.taskEditorEnabled = !!enabled;
  const controls = els.taskForm.querySelectorAll("textarea, input, select, button[type='submit'], .task-color-swatch, .chip");
  controls.forEach((control) => {
    if (control.id === "task-id") return;
    control.disabled = !state.taskEditorEnabled;
  });

  els.taskNewBtn.disabled = false;
  if (els.taskEditorHint) {
    els.taskEditorHint.textContent = state.taskEditorEnabled
      ? (state.language === "ru" ? "Режим редактирования активен." : "Edit mode is active.")
      : (
        state.language === "ru"
          ? "Выберите задачу и откройте меню карточки (⋯) -> Редактировать."
          : "Select a task and open card menu (⋯) -> Edit."
      );
  }
}

function parseFormTaskPayload() {
  return {
    subject: els.taskSubject.value.trim(),
    result: els.taskResult?.value.trim() || "",
    descriptionMd: els.taskDescription.value.trim(),
    projectName: els.taskProject.value.trim(),
    categoryIds: normalizeIdArray(state.taskCategoryIds || []),
    priority: els.taskPriority.value || null,
    startDate: els.taskStartDate.value || null,
    endDate: els.taskEndDate.value || null,
    scheduledAt: localDateTimeInputToIso(els.taskScheduledAt?.value || ""),
    plannedPomodoros: Number(els.taskPlanned.value || 0),
    spentPomodoros: Number(els.taskSpent.value || 0),
    color: els.taskColor.value || "#7dd3fc",
    attributes: parseAttributesText(els.taskAttributes.value),
    isCompleted: !!(els.taskEndDate.value || "").trim()
  };
}

function currentSettingsMinutes(key, fallback) {
  const value = Number(state.settings[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function timerDefaultDuration(kind) {
  if (kind === "break") {
    const longBreak = currentSettingsMinutes("longBreakMinutes", 30);
    const shortBreak = currentSettingsMinutes("shortBreakMinutes", 5);
    return (state.timer.workStreak > 0 && state.timer.workStreak % 4 === 0 ? longBreak : shortBreak) * 60;
  }
  return currentSettingsMinutes("workMinutes", 25) * 60;
}

function isTimerTickingEnabled() {
  const raw = String(state.settings?.timerTickingEnabled ?? "0").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

let tickAudioContext = null;

function playTimerTickSound() {
  if (!isTimerTickingEnabled()) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    tickAudioContext = tickAudioContext || new Ctx();
    if (tickAudioContext.state === "suspended") {
      void tickAudioContext.resume();
    }
    const now = tickAudioContext.currentTime;
    const osc = tickAudioContext.createOscillator();
    const gain = tickAudioContext.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1240, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain);
    gain.connect(tickAudioContext.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch (_error) {
    // Ignore audio errors to avoid breaking timer flow.
  }
}

function updateTimerView() {
  syncPomodoroTabVisibility();
  updateTodayNowIndicator();
  ensurePomodoroActionButtonsEnabled();
  updateHeaderActiveTask();
  if (els.timerKind) {
    els.timerKind.textContent = "";
  }
  els.timerDisplay.textContent = formatMinutes(state.timer.remainingSec);

  const plannedSec = Math.max(1, Number(state.timer.plannedDurationSec || timerDefaultDuration(state.timer.kind)));
  const remainingSec = Math.max(0, Number(state.timer.remainingSec || 0));
  const remainingPct = Math.max(0, Math.min(100, (remainingSec / plannedSec) * 100));
  if (els.countdownValue) {
    els.countdownValue.textContent = `${Math.round(remainingPct)}%`;
  }
  if (els.countdownProgress) {
    els.countdownProgress.style.width = `${remainingPct}%`;
  }

  const gaugeRadius = 52;
  const gaugeLength = 2 * Math.PI * gaugeRadius;
  const dashOffset = -gaugeLength * (1 - remainingPct / 100);
  if (els.countdownGaugeRing) {
    const isCriticalWork = state.timer.kind === "work" && state.timer.running && remainingPct < 10;
    const accent = state.timer.kind === "break"
      ? "#22d3ee"
      : (isCriticalWork ? "#ef4444" : (state.timer.running ? "#34d399" : "#cbd5e1"));
    els.countdownGaugeRing.style.strokeDasharray = String(gaugeLength);
    els.countdownGaugeRing.style.strokeDashoffset = String(dashOffset);
    els.countdownGaugeRing.style.stroke = accent;
    els.countdownGaugeRing.style.filter = `drop-shadow(0 0 10px ${accent}88) drop-shadow(0 0 20px ${accent}55)`;
  }
  if (els.countdownGaugeRingGloss) {
    const gloss = state.timer.kind === "break"
      ? "rgba(103, 232, 249, 0.68)"
      : ((state.timer.running && remainingPct < 10)
          ? "rgba(248, 113, 113, 0.68)"
          : (state.timer.running ? "rgba(110, 231, 183, 0.68)" : "rgba(226, 232, 240, 0.62)"));
    els.countdownGaugeRingGloss.style.strokeDasharray = String(gaugeLength);
    els.countdownGaugeRingGloss.style.strokeDashoffset = String(dashOffset);
    els.countdownGaugeRingGloss.style.stroke = gloss;
  }
  if (els.countdownGaugeValue) {
    els.countdownGaugeValue.textContent = formatMinutes(remainingSec);
  }

  const active = state.board?.activeTask;
  if (active) {
    els.timerMeta.textContent = state.language === "ru"
      ? `Активная задача: #${active.id}`
      : `Active task: #${active.id}`;
  } else {
    els.timerMeta.textContent = state.language === "ru"
      ? "Активная задача не выбрана"
      : "No active task selected";
  }

  if (active) {
    const meta = [
      active.project_name ? `#${active.project_name}` : "",
      active.category_name ? `@${active.category_name}` : "",
      active.priority ? `P:${active.priority}` : "",
      active.start_date ? `${state.language === "ru" ? "Старт" : "Start"}: ${active.start_date}` : "",
      active.end_date ? `${state.language === "ru" ? "Финиш" : "End"}: ${active.end_date}` : ""
    ]
      .filter(Boolean)
      .join(" | ");

    els.pomodoroActiveTask.innerHTML = `
      <strong>#${active.id}</strong>
      <div class="task-description">${simpleMarkdown(active.description_md || "")}</div>
      <div>${escapeHtml(meta)}</div>
      <div>${escapeHtml(
        `${state.language === "ru" ? "План/факт" : "Plan/actual"}: ${active.planned_pomodoros}/${active.spent_pomodoros}`
      )}</div>
    `;
  } else {
    els.pomodoroActiveTask.textContent =
      state.language === "ru" ? "Выберите и запустите задачу на канбан-доске" : "Select and start a task on Kanban";
  }
}

function stopTimerInterval() {
  if (state.timer.intervalId) {
    clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
}

function pushTimerRuntimeState() {
  if (typeof api.updateTimerState !== "function") return;
  api.updateTimerState({
    running: Boolean(state.timer.running),
    kind: state.timer.kind === "break" ? "break" : "work",
    taskId: Number(state.timer.taskId || 0) || null,
    sessionStartedAt: state.timer.sessionStartedAt || null,
    remainingSec: Math.max(0, Number(state.timer.remainingSec || 0)),
    plannedDurationSec: Math.max(0, Number(state.timer.plannedDurationSec || 0))
  });
}

async function interruptTimerForShutdown() {
  if (!state.timer.running) return;

  if (state.timer.kind === "break") {
    await finishCurrentSession(true, { moveToWait: false });
    return;
  }

  const interruptedTaskId = Number(state.timer.taskId || state.board?.activeTask?.id || 0);
  await finishCurrentSession(true);
  if (interruptedTaskId) {
    await moveTaskToWait(interruptedTaskId);
    await refreshBoard();
  }
}

async function recordSession(wasInterrupted) {
  const now = new Date();
  const startedAt = state.timer.sessionStartedAt || now.toISOString();
  const elapsedSec = Math.max(1, Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000));

  await api.recordPomodoroSession({
    taskId: state.timer.taskId,
    kind: state.timer.kind,
    durationMinutes: Math.max(1, Math.round(elapsedSec / 60)),
    startedAt,
    endedAt: now.toISOString(),
    wasInterrupted
  });
}

async function finishCurrentSession(wasInterrupted, options = {}) {
  if (!state.timer.sessionStartedAt) return;

  stopTimerInterval();
  state.timer.running = false;
  pushTimerRuntimeState();

  try {
    await recordSession(wasInterrupted);
    if (document.getElementById("tab-calendar")?.classList.contains("active")) {
      await loadCalendar();
    }
  } catch (error) {
    showToast(error.message);
  }

  const finishedKind = state.timer.kind;
  const interrupted = wasInterrupted;

  if (interrupted && state.timer.taskId) {
    await api.interruptTask(state.timer.taskId);
    if (options.moveToWait !== false && finishedKind === "work") {
      await moveTaskToWait(state.timer.taskId);
    }
  }

  if (!interrupted && finishedKind === "work") {
    state.timer.workStreak += 1;
    state.timer.kind = "work";
    state.timer.remainingSec = timerDefaultDuration("work");
    state.timer.plannedDurationSec = state.timer.remainingSec;
    await refreshBoard();
    openSessionDialog();
  } else if (!interrupted && finishedKind === "break") {
    state.timer.kind = "work";
    state.timer.remainingSec = timerDefaultDuration("work");
    state.timer.plannedDurationSec = state.timer.remainingSec;
    await refreshBoard();
    showToast(state.language === "ru" ? "Перерыв завершен. Запускаю следующий помидор." : "Break finished. Starting next pomodoro.");
    await startWorkSession();
  } else {
    state.timer.remainingSec = timerDefaultDuration(state.timer.kind);
    state.timer.plannedDurationSec = state.timer.remainingSec;
  }

  state.timer.sessionStartedAt = null;
  pushTimerRuntimeState();
  renderBoard();
  updateTimerView();
}

function startTimerTick(options = {}) {
  if (!hasActivePomodoroTask()) {
    showToast(state.language === "ru" ? "Нет активного помидора" : "No active pomodoro");
    return;
  }
  if (state.timer.running) return;
  const resume = Boolean(options.resume);
  const keepCurrentTab = Boolean(options.keepCurrentTab);
  state.timer.running = true;
  if (!resume || !state.timer.sessionStartedAt) {
    state.timer.sessionStartedAt = new Date().toISOString();
  }
  pushTimerRuntimeState();
  renderBoard();
  if (!keepCurrentTab) {
    setActiveTab("pomodoro");
  }

  stopTimerInterval();
  state.timer.intervalId = setInterval(async () => {
    state.timer.remainingSec -= 1;
    if (state.timer.remainingSec > 0) {
      playTimerTickSound();
    }
    if (state.timer.remainingSec <= 0) {
      state.timer.remainingSec = 0;
      updateTimerView();
      await finishCurrentSession(false);
      return;
    }
    updateTimerView();
  }, 1000);

  updateTimerView();
}

async function startWorkSession(taskId = null) {
  if (taskId) {
    state.timer.taskId = taskId;
  }
  const active = state.board?.activeTask;
  state.timer.kind = "work";
  state.timer.taskId = taskId || active?.id || null;
  state.timer.remainingSec = timerDefaultDuration("work");
  state.timer.plannedDurationSec = state.timer.remainingSec;

  if (!state.timer.taskId) {
    showToast(state.language === "ru" ? "Запуск без активной задачи" : "Starting without active task");
    return;
  }

  startTimerTick();
}

async function startTaskExecution(taskId, options = {}) {
  const numericTaskId = Number(taskId || 0);
  if (!numericTaskId) return;

  const autoStart = Boolean(options.autoStart);
  const preserveScheduledAt = Boolean(options.preserveScheduledAt);

  const processColumn = getColumnByTitle("Process");
  const currentProcessTask = (processColumn?.tasks || []).find((task) => Number(task.id) !== numericTaskId);
  if (currentProcessTask) {
    if (autoStart) return;
    const ok = confirm(
      state.language === "ru"
        ? "В колонке Процесс уже есть задача. Прервать текущую и запустить новую?"
        : "Process already contains a task. Interrupt current one and start new?"
    );
    if (!ok) return;

    await interruptTaskFlow(currentProcessTask.id, { moveToWait: true });
    await refreshBoard();
  }

  if (state.timer.running) {
    if (autoStart) return;
    await finishCurrentSession(true);
  }

  await api.setActiveTask(numericTaskId);
  if (!preserveScheduledAt) {
    await api.updateTask(numericTaskId, { scheduledAt: new Date().toISOString() });
  }
  const freshProcessColumn = state.board?.columns?.find((c) => c.title === "Process");
  const task = findTask(numericTaskId);
  if (freshProcessColumn && task && task.column_id !== freshProcessColumn.id) {
    await api.moveTask(numericTaskId, freshProcessColumn.id);
  }

  await refreshBoard();
  setActiveTab("pomodoro");
  await startWorkSession(numericTaskId);
  renderBoard();
}

async function stopTaskExecution(taskId) {
  const numericTaskId = Number(taskId || 0);
  if (state.timer.running && state.timer.kind === "work") {
    await finishCurrentSession(true);
  } else if (numericTaskId) {
    await interruptTaskFlow(numericTaskId, { moveToWait: true });
  }
  await refreshBoard();
}



function getAutoScheduledTaskCandidate(now = new Date()) {
  if (!state.board?.columns?.length) return null;
  if (state.timer.running) return null;

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;

  const gracePastMs = 10 * 60 * 1000;
  const processColumn = getColumnByTitle("Process");
  const processTasks = Array.isArray(processColumn?.tasks) ? processColumn.tasks : [];

  const tasks = (state.board.columns || [])
    .flatMap((column) => Array.isArray(column?.tasks) ? column.tasks : [])
    .filter((task) => !task?.is_completed && task?.scheduled_at)
    .map((task) => ({ task, scheduledMs: new Date(task.scheduled_at).getTime() }))
    .filter((item) => Number.isFinite(item.scheduledMs))
    .filter((item) => item.scheduledMs <= nowMs && item.scheduledMs >= nowMs - gracePastMs)
    .sort((a, b) => a.scheduledMs - b.scheduledMs);

  for (const item of tasks) {
    const task = item.task;
    const key = String(task.id) + ":" + String(task.scheduled_at || "");
    if (state.autoScheduledStartedKeys.has(key)) continue;

    const hasProcessConflict = processTasks.some((x) => Number(x.id) !== Number(task.id));
    if (hasProcessConflict) return null;

    return task;
  }

  return null;
}

async function autoStartScheduledTaskIfDue() {
  if (!state.board?.columns?.length) return;
  if (state.timer.running) return;

  const task = getAutoScheduledTaskCandidate(new Date());
  if (!task) return;

  const key = String(task.id) + ":" + String(task.scheduled_at || "");
  state.autoScheduledStartedKeys.add(key);

  try {
    await startTaskExecution(task.id, { autoStart: true, preserveScheduledAt: true });
    showToast(
      state.language === "ru"
        ? "Автозапуск по расписанию: задача #" + String(task.id)
        : "Scheduled auto-start: #" + String(task.id)
    );
  } catch (error) {
    showToast(error.message);
  }
}

function startBreakSession() {
  state.timer.kind = "break";
  state.timer.taskId = null;
  state.timer.remainingSec = timerDefaultDuration("break");
  state.timer.plannedDurationSec = state.timer.remainingSec;
  startTimerTick();
}

function closeSessionDialog() {
  els.sessionDialog.classList.add("hidden");
  if (state.sessionDialog.intervalId) {
    clearInterval(state.sessionDialog.intervalId);
    state.sessionDialog.intervalId = null;
  }
}

function openSessionDialog() {
  closeSessionDialog();
  state.sessionDialog.countdown = 10;
  els.sessionDialog.classList.remove("hidden");

  const longBreak = state.timer.workStreak > 0 && state.timer.workStreak % 4 === 0;
  const breakLabel = longBreak
    ? state.language === "ru"
      ? "длинный перерыв"
      : "long break"
    : state.language === "ru"
      ? "короткий перерыв"
      : "short break";

  els.sessionDialogText.textContent =
    state.language === "ru"
      ? `Выберите действие: начать ${breakLabel} или сразу следующий помидор.`
      : `Choose action: start ${breakLabel} or continue with next pomodoro.`;

  const updateCountdownText = () => {
    els.sessionDialogCountdown.textContent =
      state.language === "ru"
        ? `Автозапуск следующего помидора через ${state.sessionDialog.countdown} сек.`
        : `Next pomodoro auto-start in ${state.sessionDialog.countdown}s.`;
  };

  updateCountdownText();

  state.sessionDialog.intervalId = setInterval(async () => {
    state.sessionDialog.countdown -= 1;
    updateCountdownText();
    if (state.sessionDialog.countdown <= 0) {
      closeSessionDialog();
      await startWorkSession();
    }
  }, 1000);
}

function renderHeatmap(spentByDay = []) {
  const perDay = new Map((spentByDay || []).map((item) => [item.day, Number(item.value || 0)]));
  const currentMonday = getMonday(new Date());
  const weeks = [];
  for (let offset = 51; offset >= 0; offset -= 1) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - offset * 7);
    weeks.push(monday);
  }

  const monthStarts = [];
  let prevMonthKey = "";
  weeks.forEach((monday, idx) => {
    const key = `${monday.getFullYear()}-${monday.getMonth()}`;
    if (key !== prevMonthKey) {
      monthStarts.push({ idx, label: monthAbbr(monday), key });
      prevMonthKey = key;
    }
  });
  const monthStartsLast12 = monthStarts.slice(-12);
  const monthByIndex = new Map(monthStartsLast12.map((m) => [m.idx, m.label]));

  const monthRow = `
    <div class="heatmap-months">
      ${weeks
    .map((_w, idx) => `<div class="heatmap-month">${escapeHtml(monthByIndex.get(idx) || "")}</div>`)
    .join("")}
    </div>
  `;

  const grid = weeks
    .map((monday) => {
      const cells = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + dayOffset);
        const key = day.toISOString().slice(0, 10);
        const count = perDay.get(key) || 0;
        const intensity = Math.min(1, count / 16);
        const color = count === 0 ? "transparent" : `rgba(22,163,74,${0.2 + intensity * 0.8})`;
        cells.push(`<div class="heatmap-day" title="${key}: ${count}" style="background:${color}"></div>`);
      }
      return `<div class="heatmap-week">${cells.join("")}</div>`;
    })
    .join("");

  els.heatmap.innerHTML = `${monthRow}<div class="heatmap-grid">${grid}</div>`;
}

function renderFlowMetrics(tasks, sessions) {
  const completedTasks = tasks.filter((t) => !!t.completed_at);
  const leadHours = completedTasks
    .map((t) => {
      const start = new Date(t.created_at).getTime();
      const end = new Date(t.completed_at).getTime();
      return (end - start) / 36e5;
    })
    .filter((x) => Number.isFinite(x) && x >= 0);

  const avgLead = leadHours.length
    ? (leadHours.reduce((sum, x) => sum + x, 0) / leadHours.length).toFixed(1)
    : "0.0";

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const monthAgo = now - 30 * 24 * 3600 * 1000;

  const throughputTasksWeek = completedTasks.filter((t) => new Date(t.completed_at).getTime() >= weekAgo).length;
  const throughputTasksMonth = completedTasks.filter((t) => new Date(t.completed_at).getTime() >= monthAgo).length;
  const throughputPomWeek = sessions.filter(
    (s) => s.kind === "work" && !s.was_interrupted && new Date(s.ended_at).getTime() >= weekAgo
  ).length;

  const metrics = [
    { label: state.language === "ru" ? "Лид-тайм (ч)" : "Lead Time (h)", value: avgLead },
    {
      label: state.language === "ru" ? "Пропускная способность/нед (задачи)" : "Throughput/week (tasks)",
      value: String(throughputTasksWeek)
    },
    {
      label: state.language === "ru" ? "Пропускная способность/нед (помидоры)" : "Throughput/week (pomodoros)",
      value: String(throughputPomWeek)
    },
    {
      label: state.language === "ru" ? "Пропускная способность/мес (задачи)" : "Throughput/month (tasks)",
      value: String(throughputTasksMonth)
    }
  ];

  els.flowMetrics.innerHTML = metrics
    .map(
      (m) => `<article class="metric"><div class="metric-label">${escapeHtml(m.label)}</div><div class="metric-value">${escapeHtml(m.value)}</div></article>`
    )
    .join("");
}

function renderWipChart(tasks) {
  const days = 30;
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const points = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - i);
    const stamp = day.getTime();

    const wip = tasks.filter((task) => {
      const created = new Date(task.created_at).getTime();
      const completed = task.completed_at ? new Date(task.completed_at).getTime() : Number.POSITIVE_INFINITY;
      return created <= stamp && completed > stamp;
    }).length;

    points.push({ date: day.toISOString().slice(5, 10), value: wip });
  }

  const maxValue = Math.max(1, ...points.map((x) => x.value));
  els.wipChart.innerHTML = points
    .map((point) => {
      const h = Math.max(4, (point.value / maxValue) * 160);
      return `<div class="bar" style="height:${h}px" title="${point.date}: ${point.value}"></div>`;
    })
    .join("");
}

function collectDeviationGrouped(tasks, groupBy) {
  const base = (tasks || []).filter(
    (task) => ((task.planned_pomodoros || 0) > 0 || (task.spent_pomodoros || 0) > 0)
  );

  const fallbackLabel = {
    project: state.language === "ru" ? "Без проекта" : "No project",
    category: state.language === "ru" ? "Без категории" : "No category",
    priority: state.language === "ru" ? "Без приоритета" : "No priority"
  }[groupBy] || (state.language === "ru" ? "Без значения" : "No value");

  const groupField = {
    project: "project_name",
    category: "category_name",
    priority: "priority"
  }[groupBy] || "project_name";

  const grouped = new Map();
  for (const task of base) {
    const rawKey = String(task[groupField] || "").trim();
    const key = rawKey || fallbackLabel;
    if (!grouped.has(key)) {
      grouped.set(key, { key, planned: 0, spent: 0 });
    }
    const item = grouped.get(key);
    item.planned += Number(task.planned_pomodoros || 0);
    item.spent += Number(task.spent_pomodoros || 0);
  }

  return Array.from(grouped.values())
    .sort((a, b) => (b.spent + b.planned) - (a.spent + a.planned));
}

function collectDeviationByTask(tasks) {
  return (tasks || [])
    .filter((task) => ((task.planned_pomodoros || 0) > 0 || (task.spent_pomodoros || 0) > 0))
    .map((task) => ({
      key: String(task.description || task.title || task.name || task.id || "Task").trim(),
      planned: Number(task.planned_pomodoros || 0),
      spent: Number(task.spent_pomodoros || 0)
    }))
    .sort((a, b) => (b.spent + b.planned) - (a.spent + a.planned));
}

function renderDeviationVertical(targetEl, items = []) {
  if (!targetEl) return;
  const maxVal = Math.max(1, ...items.map((t) => Math.max(t.planned || 0, t.spent || 0)));
  targetEl.classList.add("deviation-vertical");
  targetEl.classList.remove("deviation-horizontal");
  targetEl.innerHTML = items
    .map((item) => {
      const planned = item.planned || 0;
      const spent = item.spent || 0;
      const hPlan = Math.max(4, (planned / maxVal) * 160);
      const hSpent = Math.max(4, (spent / maxVal) * 160);
      return [
        '<div class="bar-group" title="' + escapeHtml(item.key) + ' plan:' + planned + ' fact:' + spent + '">',
        '  <div class="bar-pair">',
        '    <div class="bar" style="height:' + hPlan + 'px"></div>',
        '    <div class="bar" data-variant="actual" style="height:' + hSpent + 'px"></div>',
        '  </div>',
        '  <div class="bar-label">' + escapeHtml(item.key) + '</div>',
        '</div>'
      ].join('');
    })
    .join("");
}

function renderDeviationHorizontal(targetEl, items = []) {
  if (!targetEl) return;
  const maxVal = Math.max(1, ...items.map((t) => Math.max(t.planned || 0, t.spent || 0)));
  targetEl.classList.add("deviation-horizontal");
  targetEl.classList.remove("deviation-vertical");
  targetEl.innerHTML = items
    .map((item) => {
      const planned = item.planned || 0;
      const spent = item.spent || 0;
      const plannedPct = Math.max(0, Math.min(100, (planned / maxVal) * 100));
      const spentPct = Math.max(0, Math.min(100, (spent / maxVal) * 100));
      return [
        '<div class="hbar-row" title="' + escapeHtml(item.key) + ' plan:' + planned + ' fact:' + spent + '">',
        '  <div class="hbar-label">' + escapeHtml(item.key) + '</div>',
        '  <div class="hbar-track">',
        '    <div class="hbar hbar-plan" style="width:' + plannedPct + '%"><span>' + planned + '</span></div>',
        '    <div class="hbar hbar-actual" style="width:' + spentPct + '%"><span>' + spent + '</span></div>',
        '  </div>',
        '</div>'
      ].join('');
    })
    .join("");
}

function renderDeviationCharts(tasks) {
  const byPriority = collectDeviationGrouped(tasks, "priority");
  const byProject = collectDeviationGrouped(tasks, "project");
  const byCategory = collectDeviationGrouped(tasks, "category");
  const byTask = collectDeviationByTask(tasks).slice(0, 24);
  renderDeviationHorizontal(els.deviationChartPriority, byPriority);
  renderDeviationHorizontal(els.deviationChartProject, byProject);
  renderDeviationHorizontal(els.deviationChartCategory, byCategory);
  renderDeviationVertical(els.deviationChartTask, byTask);
}


async function loadAnalytics() {
  try {
    const data = await api.getAnalytics(state.analyticsFilters);
    state.analytics = data;
    renderHeatmap(data.spentByDay || []);
    renderFlowMetrics(data.tasks || [], data.sessions || []);
    renderWipChart(data.tasks || []);
    renderDeviationCharts(data.tasks || []);
  } catch (error) {
    showToast(error.message);
  }
}

function renderCalendar() {
  if (!els.calendarWeeks) return;

  const start = getCalendarBaseMonday();
  const weekTitles = [];
  const weekOffsets = [0, 7, 14];
  const weekKinds = ["previous", "current", "next"];
  const locale = LOCALE_BY_LANGUAGE[state.language] || "en-US";
  const dayNames = [0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
    const d = new Date(Date.UTC(2026, 0, 5 + dayOffset));
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });

  const slotHeight = 15;
  const dayHeight = 48 * slotHeight;

  const sessions = Array.isArray(state.calendarSessions) ? state.calendarSessions : [];
  const planned = Array.isArray(state.calendarScheduled) ? state.calendarScheduled : [];
  const plannedSec = Math.max(1, Number(timerDefaultDuration("work")));

  const weekHtml = weekOffsets.map((offset, weekIndex) => {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + offset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const kind = weekKinds[weekIndex];
    const ruPrefix = kind === "previous"
      ? "Предыдущая неделя"
      : kind === "current"
        ? "Текущая неделя"
        : "Следующая неделя";
    const enPrefix = kind === "previous"
      ? "Previous week"
      : kind === "current"
        ? "Current week"
        : "Next week";

    weekTitles.push(
      state.language === "ru"
        ? `${ruPrefix}: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`
        : `${enPrefix}: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`
    );

    const timeAxis = Array.from({ length: 12 }).map((_, idx) => {
      const hours = String(idx * 2).padStart(2, "0");
      const top = idx * slotHeight * 4;
      return `<div class="calendar-time-label" style="top:${top}px">${hours}:00</div>`;
    }).join("");

    const dayColumns = Array.from({ length: 7 }).map((_, dayOffset) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + dayOffset);
      dayDate.setHours(0, 0, 0, 0);
      const dayStartMs = dayDate.getTime();
      const dayEndMs = dayStartMs + 24 * 3600 * 1000;

      const stripes = Array.from({ length: 48 })
        .map((__, slot) => `<div class="calendar-halfhour-line" style="top:${slot * slotHeight}px"></div>`)
        .join("");

      const plannedItems = planned
        .map((event) => {
          const startMs = new Date(event.scheduled_at).getTime();
          if (!Number.isFinite(startMs)) return null;

          const clippedStart = Math.max(startMs, dayStartMs);
          const clippedEnd = Math.min(startMs + plannedSec * 1000, dayEndMs);
          if (clippedEnd <= clippedStart) return null;

          const fromMidnightMin = (clippedStart - dayStartMs) / 60000;
          const durationMin = Math.max(1, (clippedEnd - clippedStart) / 60000);
          const top = (fromMidnightMin / 30) * slotHeight;
          const height = Math.max(6, (durationMin / 30) * slotHeight);
          const titleText = getTaskShortLabel(event);
          const startText = formatTime(event.scheduled_at);

          return `<div class="calendar-scheduled" style="top:${top}px;height:${height}px" title="${escapeHtml(`${startText} ${titleText}`)}">${escapeHtml(`${startText} ${titleText}`)}</div>`;
        })
        .filter(Boolean)
        .join("");

      const sessionItems = sessions
        .map((session) => {
          const startMs = new Date(session.started_at).getTime();
          const endMs = new Date(session.ended_at).getTime();
          if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;

          const clippedStart = Math.max(startMs, dayStartMs);
          const clippedEnd = Math.min(endMs, dayEndMs);
          if (clippedEnd <= clippedStart) return null;

          const fromMidnightMin = (clippedStart - dayStartMs) / 60000;
          const durationMin = Math.max(1, (clippedEnd - clippedStart) / 60000);
          const top = (fromMidnightMin / 30) * slotHeight;
          const height = Math.max(6, (durationMin / 30) * slotHeight);

          const startText = formatTime(session.started_at);
          const endText = formatTime(session.ended_at);
          const titleSource = String(session.task_snapshot || "").trim();
          const fallbackTitle = session.task_id ? `#${session.task_id}` : (state.language === "ru" ? "Без задачи" : "No task");
          const text = titleSource || fallbackTitle;
          const interruptedClass = session.was_interrupted ? " interrupted" : "";

          return `<div class="calendar-pomodoro${interruptedClass}" style="top:${top}px;height:${height}px" title="${escapeHtml(`${startText}-${endText} ${text}`)}">${escapeHtml(`${startText} ${text}`)}</div>`;
        })
        .filter(Boolean)
        .join("");

      const dayHead = `${dayNames[dayOffset]} ${String(dayDate.getDate()).padStart(2, "0")}`;
      return `
        <div class="calendar-day">
          <div class="calendar-day-head">${escapeHtml(dayHead)}</div>
          <div class="calendar-day-col" style="height:${dayHeight}px">
            ${stripes}
            ${plannedItems}
            ${sessionItems}
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="calendar-week">
        <h3 class="calendar-week-title">${escapeHtml(weekTitles[weekIndex])}</h3>
        <div class="calendar-week-body">
          <div class="calendar-time-axis" style="height:${dayHeight}px">${timeAxis}</div>
          <div class="calendar-days">${dayColumns}</div>
        </div>
      </section>
    `;
  }).join("");

  els.calendarWeeks.innerHTML = weekHtml;
}

async function loadCalendar() {
  try {
    const range = getCalendarRangeIso();
    const [sessions, scheduled] = await Promise.all([
      api.listCalendarSessions(range.from, range.to),
      api.listCalendarScheduled(range.from, range.to)
    ]);
    state.calendarSessions = Array.isArray(sessions) ? sessions : [];
    state.calendarScheduled = Array.isArray(scheduled) ? scheduled : [];
    renderCalendar();
    if (state.board?.columns?.length) {
      renderBoard();
    }
  } catch (error) {
    showToast(error.message);
  }
}

function renderArchiveTable() {
  const rows = applyTableSort(state.archive || [], state.archiveSort);
  els.archiveTableBody.innerHTML = rows
    .map(
      (row) => `
      <tr data-archive-id="${row.id}" class="archive-row">
        <td>${escapeHtml(row.task_id)}</td>
        <td><strong>${escapeHtml(row.subject || "")}</strong></td>
        <td>${escapeHtml(row.project_name || "")}</td>
        <td>${escapeHtml(row.category_name || "")}</td>
        <td>${escapeHtml(row.priority || "")}</td>
        <td>${escapeHtml(formatDateTime(row.scheduled_at))}</td>
        <td>${escapeHtml(row.planned_pomodoros || 0)}</td>
        <td>${escapeHtml(row.spent_pomodoros || 0)}</td>
        <td>${escapeHtml(formatDate(row.completed_at))}</td>
      </tr>
    `
    )
    .join("");

  els.archiveTableHead.querySelectorAll("th[data-sort-key]").forEach((th) => {
    const key = th.dataset.sortKey;
    const base = th.dataset.i18n ? t(th.dataset.i18n) : (key === "task_id" ? "ID" : th.textContent.trim());
    th.textContent = `${base}${getSortIndicator(state.archiveSort, key)}`;
  });
}

async function loadArchive() {
  try {
    state.archive = await api.listArchive(state.archiveFilters);
    renderArchiveTable();
  } catch (error) {
    showToast(error.message);
  }
}

function renderBacklogTable() {
  const rows = applyTableSort(state.backlog || [], state.backlogSort);
  els.backlogTableBody.innerHTML = rows
    .map(
      (row) => `
      <tr data-task-id="${row.id}" class="backlog-row">
        <td>${escapeHtml(row.id)}</td>
        <td><strong>${escapeHtml(row.subject || "")}</strong></td>
        <td>${escapeHtml(row.project_name || "")}</td>
        <td>${escapeHtml(row.category_name || "")}</td>
        <td>${escapeHtml(row.priority || "")}</td>
        <td>${escapeHtml(formatDateTime(row.scheduled_at))}</td>
        <td>${escapeHtml(row.planned_pomodoros || 0)}</td>
        <td>${escapeHtml(row.spent_pomodoros || 0)}</td>
      </tr>
    `
    )
    .join("");

  els.backlogTableHead.querySelectorAll("th[data-sort-key]").forEach((th) => {
    const key = th.dataset.sortKey;
    const base = th.dataset.i18n ? t(th.dataset.i18n) : (key === "id" ? "ID" : th.textContent.trim());
    th.textContent = `${base}${getSortIndicator(state.backlogSort, key)}`;
  });
}

async function loadBacklog() {
  try {
    state.backlog = await api.listBacklog(state.backlogFilters);
    renderBacklogTable();
  } catch (error) {
    showToast(error.message);
  }
}

function applySettingsToForm() {
  els.settingsWorkMinutes.value = state.settings.workMinutes || "25";
  els.settingsShortBreak.value = state.settings.shortBreakMinutes || "5";
  els.settingsLongBreak.value = state.settings.longBreakMinutes || "30";
  if (els.settingsWorkdayStart) {
    els.settingsWorkdayStart.value = normalizeTimeValue(state.settings.workdayStart, "");
  }
  if (els.settingsWorkdayEnd) {
    els.settingsWorkdayEnd.value = normalizeTimeValue(state.settings.workdayEnd, "");
  }
  if (els.settingsKanbanProcessView) {
    els.settingsKanbanProcessView.value = getKanbanProcessViewMode();
  }
  const formTheme = ["system", "light", "dark"].includes(String(state.settings.theme || "")) ? state.settings.theme : "light";
  els.settingsTheme.value = formTheme;
  els.settingsLanguage.value = state.settings.language || "ru";
  if (els.settingsTickingEnabled) {
    els.settingsTickingEnabled.checked = isTimerTickingEnabled();
  }
  if (els.settingsMarkdownExtendedEnabled) {
    els.settingsMarkdownExtendedEnabled.checked = isExtendedMarkdownEnabled();
  }

  state.language = state.settings.language || "ru";
  applyTranslations();
  setTaskEditorEnabled(state.taskEditorEnabled);
  applyTheme(state.settings.theme || "light");
  renderCalendar();

  if (!state.timer.running) {
    state.timer.remainingSec = timerDefaultDuration(state.timer.kind);
    state.timer.plannedDurationSec = state.timer.remainingSec;
  }
  updateTimerView();
  renderDbProfiles();
  if (state.board) {
    renderBoard();
  }
}

function renderDbProfiles() {
  if (!els.settingsDbProfile) return;
  const rows = Array.isArray(state.dbProfiles?.profiles) ? state.dbProfiles.profiles : [];
  const selected = state.dbProfiles?.selectedPath || state.dbProfiles?.currentPath || "";
  const options = rows.length
    ? rows
      .map((row) => {
        const selectedAttr = String(row.path) === String(selected) ? "selected" : "";
        const label = row.label ? `${row.label} — ${row.path}` : row.path;
        return `<option value="${escapeHtml(row.path)}" ${selectedAttr}>${escapeHtml(label)}</option>`;
      })
      .join("")
    : `<option value="">${escapeHtml(state.language === "ru" ? "Нет профилей БД" : "No DB profiles")}</option>`;

  els.settingsDbProfile.innerHTML = options;
  if (els.settingsDbCurrent) {
    const current = state.dbProfiles?.currentPath || "";
    els.settingsDbCurrent.textContent = current
      ? `${state.language === "ru" ? "Текущая БД:" : "Current DB:"} ${current}`
      : (state.language === "ru" ? "Текущая БД не выбрана" : "Current DB is not selected");
  }
}

async function loadDbProfiles() {
  if (typeof api.listDbProfiles !== "function") return;
  state.dbProfiles = await api.listDbProfiles();
  renderDbProfiles();
}

async function refreshBoard() {
  const board = await api.loadBoard(state.filters);
  state.board = board;
  state.settings = {
    ...state.settings,
    ...(board.settings || {})
  };

  renderFilterSelects();
  renderBoard();
  updateHeaderActiveTask();
  updateTimerView();
}

function bindEvents() {
  ensurePomodoroActionButtonsEnabled();

  const submitTodoTxt = async () => {
    const line = els.todotxtInput.value;
    if (!line || !line.trim()) return;

    try {
      await api.addTodoTxt(line.trim());
      els.todotxtInput.value = "";
      await refreshBoard();
      showToast(state.language === "ru" ? "Задача добавлена во Входящие" : "Task added to Inbox");
    } catch (error) {
      showToast(error.message);
    }
  };

  els.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  els.todotxtAddBtn.addEventListener("click", submitTodoTxt);
  els.todotxtInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    await submitTodoTxt();
  });

  els.applyFiltersBtn.addEventListener("click", async () => {
    state.filters = {
      descriptionFragment: els.filterDescription.value.trim(),
      projectId: els.filterProject.value,
      categoryIds: normalizeIdArray(state.filters.categoryIds),
      priority: els.filterPriority.value,
      startDateFrom: els.filterStartDate.value,
      attributeKey: els.filterAttrKey.value.trim(),
      attributeValue: els.filterAttrValue.value.trim()
    };

    await refreshBoard();
  });

  els.resetFiltersBtn.addEventListener("click", async () => {
    state.filters = {
      descriptionFragment: "",
      projectId: "",
      categoryIds: [],
      priority: "",
      startDateFrom: "",
      attributeKey: "",
      attributeValue: ""
    };

    els.filterDescription.value = "";
    els.filterProject.value = "";
    els.filterPriority.value = "";
    els.filterStartDate.value = "";
    els.filterAttrKey.value = "";
    els.filterAttrValue.value = "";
    renderFilterSelects();

    await refreshBoard();
  });

  els.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = parseFormTaskPayload();
    if (!state.taskEditorResultOnly && !payload.descriptionMd) {
      showToast(state.language === "ru" ? "Введите описание задачи" : "Task description is required");
      return;
    }

    try {
      const taskId = Number(els.taskId.value || 0);
      if (taskId <= 0) {
        showToast(
          state.language === "ru"
            ? "Редактор доступен только для изменения существующих задач."
            : "Editor is available only for editing existing tasks."
        );
        return;
      }
      const updatePayload = state.taskEditorResultOnly ? { result: payload.result } : payload;
      await api.updateTask(taskId, updatePayload);
      showToast(state.language === "ru" ? "Задача обновлена" : "Task updated");
      clearTaskForm();
      closeModal(els.taskEditorModal);
      await refreshBoard();
      if (document.getElementById("tab-backlog")?.classList.contains("active")) {
        await loadBacklog();
      }
      if (document.getElementById("tab-archive")?.classList.contains("active")) {
        await loadArchive();
      }
    } catch (error) {
      showToast(error.message);
    }
  });

  els.taskColorPalette?.addEventListener("click", (event) => {
    const swatch = event.target.closest(".task-color-swatch");
    if (!swatch || swatch.disabled) return;
    setTaskColor(swatch.dataset.color || CARD_COLOR_PRESETS[0]);
  });

  els.taskNewBtn.addEventListener("click", () => {
    clearTaskForm();
    renderBoard();
  });

  els.addColumnBtn.addEventListener("click", async () => {
    const title = els.newColumnTitle.value.trim();
    if (!title) return;

    try {
      await api.createColumn(title);
      els.newColumnTitle.value = "";
      await refreshBoard();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.addProjectBtn.addEventListener("click", async () => {
    const name = els.newProjectName.value.trim();
    if (!name) return;

    try {
      await api.createProject(name);
      els.newProjectName.value = "";
      await refreshBoard();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.addCategoryBtn.addEventListener("click", async () => {
    const name = els.newCategoryName.value.trim();
    if (!name) return;

    try {
      await api.createCategory(name);
      els.newCategoryName.value = "";
      await refreshBoard();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.board.addEventListener("click", async (event) => {
    const link = event.target.closest("a[href]");
    if (link && link.closest(".task-card")) {
      const href = link.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        event.preventDefault();
        event.stopPropagation();
        try {
          await api.openExternal(href);
        } catch (error) {
          showToast(error.message);
        }
        return;
      }
    }

    const actionTarget = event.target.closest("[data-action]");
    const taskCard = event.target.closest(".task-card");
    closeTaskContextMenu();

    if (taskCard && !actionTarget) {
      state.selectedTaskId = Number(taskCard.dataset.taskId || 0);
      els.board.querySelectorAll(".task-card").forEach((card) => card.classList.remove("selected"));
      taskCard.classList.add("selected");
      return;
    }

    if (!actionTarget) return;

    const action = actionTarget.dataset.action;
    const columnId = Number(actionTarget.dataset.columnId || 0);

    try {
      if (action === "delete-column") {
        await api.deleteColumn(columnId);
      }

      await refreshBoard();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.board.addEventListener("contextmenu", (event) => {
    const todayTaskEntry = event.target.closest(".today-task-entry[data-task-id]");
    if (todayTaskEntry) {
      event.preventDefault();
      const taskId = Number(todayTaskEntry.dataset.taskId || 0);
      if (!taskId) return;
      const menuMode = String(todayTaskEntry.dataset.menuMode || "today-inactive");
      state.selectedTaskId = taskId;
      renderBoard();
      openTodayTaskContextMenu(taskId, event.clientX, event.clientY, menuMode);
      return;
    }

    const taskCard = event.target.closest(".task-card");
    if (!taskCard) return;
    event.preventDefault();
    const taskId = Number(taskCard.dataset.taskId || 0);
    state.selectedTaskId = taskId;
    renderBoard();
    openTaskContextMenu(taskId, event.clientX, event.clientY);
  });

  els.board.addEventListener("dblclick", (event) => {
    const taskCard = event.target.closest(".task-card");
    if (!taskCard) return;
    const taskId = Number(taskCard.dataset.taskId || 0);
    const task = findTask(taskId);
    if (!task) return;
    fillTaskForm(task);
    openModal(els.taskEditorModal);
    closeTaskContextMenu();
  });

  els.taskContextMenu.addEventListener("click", async (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;

    const taskId = Number(state.contextMenuTaskId || 0);
    if (!taskId) {
      closeTaskContextMenu();
      return;
    }

    try {
      if (btn.id === "context-start-stop-btn") {
        if (btn.dataset.mode === "stop") {
          await stopTaskExecution(taskId);
        } else {
          await startTaskExecution(taskId);
        }
      }

      if (btn.id === "context-wait-btn") {
        if (isTaskRunning(taskId)) {
          await stopTaskExecution(taskId);
          return;
        }
        const waitColumn = getColumnByTitle("Wait");
        if (!waitColumn) {
          throw new Error(state.language === "ru" ? "Колонка Ожидание не найдена" : "Wait column is missing");
        }
        await api.moveTask(taskId, waitColumn.id);
        await api.interruptTask(taskId);
        await refreshBoard();
      }

      if (btn.id === "context-done-btn") {
        const ok = confirm(
          state.language === "ru"
            ? "Переместить задачу в Готово?"
            : "Move task to Done?"
        );
        if (!ok) return;
        if (isTaskRunning(taskId)) {
          await finishCurrentSession(true, { moveToWait: false });
        }
        const doneColumn = getColumnByTitle("Done");
        if (!doneColumn) {
          throw new Error(state.language === "ru" ? "Колонка Готово не найдена" : "Done column is missing");
        }
        await api.moveTask(taskId, doneColumn.id);
        await api.interruptTask(taskId);
        await refreshBoard();
      }

      if (btn.id === "context-clone-btn") {
        const sourceTask = await api.getTask(taskId);
        if (!sourceTask) {
          throw new Error(state.language === "ru" ? "Задача не найдена" : "Task not found");
        }
        const inboxColumn = getColumnByTitle("Inbox");
        if (!inboxColumn) {
          throw new Error(state.language === "ru" ? "Колонка Входящие не найдена" : "Inbox column is missing");
        }
        await api.createTask({
          subject: sourceTask.subject || "",
          result: sourceTask.result || "",
          descriptionMd: sourceTask.description_md || "",
          color: sourceTask.color || "#7dd3fc",
          priority: sourceTask.priority || null,
          scheduledAt: sourceTask.scheduled_at || null,
          startDate: sourceTask.start_date || null,
          endDate: sourceTask.end_date || null,
          plannedPomodoros: Number(sourceTask.planned_pomodoros || 1),
          spentPomodoros: 0,
          projectId: sourceTask.project_id || null,
          categoryIds: sourceTask.category_ids || [],
          attributes: sourceTask.attributes || {},
          columnId: inboxColumn.id
        });
        await refreshBoard();
        showToast(state.language === "ru" ? "Клон добавлен во Входящие" : "Clone added to Inbox");
      }

      if (btn.id === "context-edit-btn") {
        const task = findTask(taskId);
        fillTaskForm(task);
        if (btn.dataset.mode === "view") {
          setTaskEditorEnabled(false);
        } else if (btn.dataset.mode === "result-only") {
          setTaskEditorResultOnlyMode(true);
        }
        openModal(els.taskEditorModal);
      }

      if (btn.id === "context-backlog-btn") {
        await api.addToBacklog(taskId);
        await refreshBoard();
        if (document.getElementById("tab-backlog")?.classList.contains("active")) {
          await loadBacklog();
        }
      }

      if (btn.id === "context-delete-btn") {
        const ok = confirm(
          state.language === "ru"
            ? "Удалить задачу? Это действие нельзя отменить."
            : "Delete task? This action cannot be undone."
        );
        if (ok) {
          await api.deleteTask(taskId);
          if (String(taskId) === String(state.selectedTaskId)) {
            clearTaskForm();
          }
          await refreshBoard();
        }
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      closeTaskContextMenu();
    }
  });

  document.addEventListener("click", () => {
    closeTaskContextMenu();
    closeBacklogTaskMenu();
    closeBacklogMoveMenu();
    closeArchiveTaskMenu();
  });

  els.backlogApplyBtn.addEventListener("click", async () => {
    state.backlogFilters = {
      descriptionFragment: els.backlogFilterDescription.value.trim(),
      projectId: els.backlogFilterProject.value,
      categoryIds: normalizeIdArray(state.backlogFilters.categoryIds),
      priority: els.backlogFilterPriority.value,
      startDateFrom: els.backlogFilterStartDate.value,
      attributeKey: els.backlogFilterAttrKey.value.trim(),
      attributeValue: els.backlogFilterAttrValue.value.trim()
    };
    await loadBacklog();
  });

  els.backlogResetBtn.addEventListener("click", async () => {
    state.backlogFilters = {
      descriptionFragment: "",
      projectId: "",
      categoryIds: [],
      priority: "",
      startDateFrom: "",
      attributeKey: "",
      attributeValue: ""
    };
    els.backlogFilterDescription.value = "";
    els.backlogFilterProject.value = "";
    els.backlogFilterPriority.value = "";
    els.backlogFilterStartDate.value = "";
    els.backlogFilterAttrKey.value = "";
    els.backlogFilterAttrValue.value = "";
    renderFilterSelects();
    await loadBacklog();
  });

  els.backlogTableBody.addEventListener("click", async (event) => {
    event.stopPropagation();
    const link = event.target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        event.preventDefault();
        try {
          await api.openExternal(href);
        } catch (error) {
          showToast(error.message);
        }
      }
      return;
    }

    const row = event.target.closest("tr[data-task-id]");
    if (!row) return;
    const taskId = Number(row.dataset.taskId || 0);
    if (!taskId) return;
    openBacklogMoveMenu(taskId, event.clientX, event.clientY);
  });

  els.backlogTableBody.addEventListener("contextmenu", (event) => {
    const row = event.target.closest("tr[data-task-id]");
    if (!row) return;
    event.preventDefault();
    event.stopPropagation();
    const taskId = Number(row.dataset.taskId || 0);
    if (!taskId) return;
    openBacklogTaskMenu(taskId, event.clientX, event.clientY);
  });

  els.backlogTaskMenu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const btn = event.target.closest("button");
    if (!btn) return;

    const taskId = Number(els.backlogTaskMenu.dataset.taskId || 0);
    if (!taskId) {
      closeBacklogTaskMenu();
      return;
    }

    try {
      const toColumnId = Number(btn.dataset.columnId || 0);
      if (toColumnId) {
        await api.moveFromBacklog(taskId, toColumnId);
        await refreshBoard();
        await loadBacklog();
        showToast(state.language === "ru" ? "Задача перемещена" : "Task moved");
        return;
      }

      if (btn.id === "backlog-menu-edit-btn") {
        const task = await api.getTask(taskId);
        if (!task) throw new Error(state.language === "ru" ? "Задача не найдена" : "Task not found");
        fillTaskForm(task);
        openModal(els.taskEditorModal);
      }

      if (btn.id === "backlog-menu-delete-btn") {
        const ok = confirm(t("backlogDeleteConfirm"));
        if (!ok) return;
        await api.deleteTask(taskId);
        if (String(taskId) === String(state.selectedTaskId)) {
          clearTaskForm();
        }
        await refreshBoard();
        await loadBacklog();
        showToast(state.language === "ru" ? "Задача удалена" : "Task deleted");
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      closeBacklogTaskMenu();
    }
  });

  els.backlogTableHead.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.dataset.sortKey;
    if (!key) return;
    if (state.backlogSort.key === key) {
      state.backlogSort.dir = state.backlogSort.dir === "asc" ? "desc" : "asc";
    } else {
      state.backlogSort = { key, dir: "asc" };
    }
    renderBacklogTable();
  });

  els.backlogMoveMenu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const menuButton = event.target.closest("button[data-column-id]");
    if (!menuButton) return;
    const taskId = Number(els.backlogMoveMenu.dataset.taskId || 0);
    const toColumnId = Number(menuButton.dataset.columnId || 0);
    if (!taskId || !toColumnId) {
      closeBacklogMoveMenu();
      return;
    }
    try {
      await api.moveFromBacklog(taskId, toColumnId);
      closeBacklogMoveMenu();
      await refreshBoard();
      await loadBacklog();
    } catch (error) {
      showToast(error.message);
    }
  });

  els.archiveApplyBtn.addEventListener("click", async () => {
    state.archiveFilters = {
      descriptionFragment: els.archiveFilterDescription.value.trim(),
      projectId: els.archiveFilterProject.value,
      categoryIds: normalizeIdArray(state.archiveFilters.categoryIds),
      priority: els.archiveFilterPriority.value,
      completedFrom: els.archiveFilterCompletedFrom.value
    };
    await loadArchive();
  });

  els.archiveResetBtn.addEventListener("click", async () => {
    state.archiveFilters = {
      descriptionFragment: "",
      projectId: "",
      categoryIds: [],
      priority: "",
      completedFrom: ""
    };
    els.archiveFilterDescription.value = "";
    els.archiveFilterProject.value = "";
    els.archiveFilterPriority.value = "";
    els.archiveFilterCompletedFrom.value = "";
    renderFilterSelects();
    await loadArchive();
  });

  els.archiveTableHead.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.dataset.sortKey;
    if (!key) return;
    if (state.archiveSort.key === key) {
      state.archiveSort.dir = state.archiveSort.dir === "asc" ? "desc" : "asc";
    } else {
      state.archiveSort = { key, dir: "asc" };
    }
    renderArchiveTable();
  });

  els.archiveTableBody.addEventListener("click", async (event) => {
    event.stopPropagation();
    const link = event.target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        event.preventDefault();
        try {
          await api.openExternal(href);
        } catch (error) {
          showToast(error.message);
        }
      }
      return;
    }

    const row = event.target.closest("tr[data-archive-id]");
    if (!row) return;
    const archiveId = Number(row.dataset.archiveId || 0);
    if (!archiveId) return;
    openArchiveTaskMenu(archiveId, event.clientX, event.clientY);
  });

  els.archiveTaskMenu.addEventListener("click", async (event) => {
    event.stopPropagation();
    const btn = event.target.closest("button");
    if (!btn) return;
    const archiveId = Number(els.archiveTaskMenu.dataset.archiveId || 0);
    if (!archiveId) {
      closeArchiveTaskMenu();
      return;
    }
    const row = (state.archive || []).find((item) => Number(item.id) === archiveId);
    if (!row) {
      closeArchiveTaskMenu();
      return;
    }

    try {
      if (btn.id === "archive-menu-view-btn") {
        await openArchiveTaskViewModal(row);
      } else if (btn.id === "archive-menu-create-btn") {
        await api.cloneArchiveToInbox(archiveId);
        await refreshBoard();
        showToast(state.language === "ru" ? "Клон добавлен во Входящие" : "Clone added to Inbox");
        await loadArchive();
      } else if (btn.id === "archive-menu-delete-btn") {
        const ok = confirm(t("archiveDeleteConfirm"));
        if (!ok) return;
        await api.deleteArchive(archiveId);
        showToast(state.language === "ru" ? "Запись удалена из архива" : "Archive record deleted");
        await loadArchive();
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      closeArchiveTaskMenu();
    }
  });

  els.timerStopBtn.addEventListener("click", async () => {
    const okInterrupt = confirm(t("confirmPomodoroInterrupt"));
    if (!okInterrupt) return;

    if (!state.timer.running) {
      const targetTask = getPomodoroTargetTask();
      if (!targetTask?.id) {
        showToast(state.language === "ru" ? "Нет активной задачи" : "No active task");
        return;
      }
      await interruptTaskFlow(targetTask.id, { moveToWait: true });
      await refreshBoard();
      showToast(state.language === "ru" ? "Текущая задача прервана" : "Current task interrupted");
      return;
    }
    if (state.timer.kind === "break") {
      await finishCurrentSession(true);
      await startWorkSession();
      showToast(
        state.language === "ru"
          ? "Перерыв прерван. Запущен следующий помидор."
          : "Break interrupted. Next pomodoro started."
      );
      return;
    }
    const interruptedTaskId = Number(state.timer.taskId || state.board?.activeTask?.id || 0);
    await finishCurrentSession(true);
    if (interruptedTaskId) {
      await moveTaskToWait(interruptedTaskId);
      await refreshBoard();
    }
    showToast(state.language === "ru" ? "Текущий помидор прерван" : "Current pomodoro interrupted");
  });

  els.timerMarkDoneBtn.addEventListener("click", async () => {
    const okMarkDone = confirm(t("confirmTaskCompleteFromPomodoro"));
    if (!okMarkDone) return;

    const active = getPomodoroTargetTask();
    if (!active) {
      showToast(state.language === "ru" ? "Нет активной задачи" : "No active task");
      return;
    }

    if (state.timer.running) {
      await finishCurrentSession(true, { moveToWait: false });
    }
    await api.incrementTaskSpent(active.id, 1, "mark_done");
    await api.completeTask(active.id);
    await refreshBoard();
    if (document.getElementById("tab-archive")?.classList.contains("active")) {
      await loadArchive();
    }
    showToast(state.language === "ru" ? "Задача завершена" : "Task completed");
  });

  els.sessionBreakBtn.addEventListener("click", () => {
    closeSessionDialog();
    startBreakSession();
  });

  els.sessionNextBtn.addEventListener("click", async () => {
    closeSessionDialog();
    await startWorkSession();
  });

  els.closeTaskEditorModalBtn.addEventListener("click", () => {
    closeModal(els.taskEditorModal);
  });

  els.taskEditorModal.addEventListener("click", (event) => {
    if (event.target === els.taskEditorModal) {
      closeModal(els.taskEditorModal);
    }
  });

  els.closeArchiveTaskViewModalBtn?.addEventListener("click", () => {
    closeArchiveTaskViewModal();
  });

  els.archiveTaskViewModal?.addEventListener("click", (event) => {
    if (event.target === els.archiveTaskViewModal) {
      closeArchiveTaskViewModal();
    }
  });

  els.archiveViewCloneBtn?.addEventListener("click", async () => {
    const archiveId = Number(els.archiveViewCloneBtn.dataset.archiveId || 0);
    if (!archiveId) return;
    try {
      await api.cloneArchiveToInbox(archiveId);
      await refreshBoard();
      await loadArchive();
      showToast(state.language === "ru" ? "Клон добавлен во Входящие" : "Clone added to Inbox");
      closeArchiveTaskViewModal();
    } catch (error) {
      showToast(error.message);
    }
  });


  [
    [els.taskCategoryChips, "task"],
    [els.filterCategoryChips, "board"],
    [els.analyticsFilterCategoryChips, "analytics"],
    [els.backlogFilterCategoryChips, "backlog"],
    [els.archiveFilterCategoryChips, "archive"]
  ].forEach(([container, key]) => {
    if (!container) return;
    container.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-category-chip-id]");
      if (!chip) return;
      toggleCategorySelection(key, chip.dataset.categoryChipId);
    });
  });

  els.analyticsApplyBtn.addEventListener("click", async () => {
    state.analyticsFilters = {
      projectId: els.analyticsFilterProject.value,
      categoryIds: normalizeIdArray(state.analyticsFilters.categoryIds),
      priority: els.analyticsFilterPriority.value
    };
    await loadAnalytics();
  });

  if (els.deviationGroupBy) {
    els.deviationGroupBy.addEventListener("change", () => {
      state.analyticsDeviationGroupBy = els.deviationGroupBy.value || "task";
      renderDeviationCharts(state.analytics.tasks || []);
    });
  }

  if (typeof api.onShutdownInterruptRequest === "function") {
    api.onShutdownInterruptRequest(async () => {
      await interruptTimerForShutdown();
    });
  }

  if (els.settingsDbCreateBtn) {
    els.settingsDbCreateBtn.addEventListener("click", async () => {
      try {
        const dbPath = await api.chooseDbProfilePath();
        if (!dbPath) return;
        state.dbProfiles = await api.createEmptyDbProfile(dbPath);
        renderDbProfiles();
        showToast(state.language === "ru" ? "Новая пустая БД создана" : "New empty DB created");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  if (els.settingsDbPickBtn) {
    els.settingsDbPickBtn.addEventListener("click", async () => {
      try {
        const dbPath = await api.chooseDbProfilePath();
        if (!dbPath) return;
        state.dbProfiles = await api.addDbProfile(dbPath);
        renderDbProfiles();
        showToast(state.language === "ru" ? "Путь БД добавлен" : "DB path added");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  if (els.settingsDbActivateBtn) {
    els.settingsDbActivateBtn.addEventListener("click", async () => {
      const dbPath = String(els.settingsDbProfile?.value || "").trim();
      if (!dbPath) return;
      try {
        state.dbProfiles = await api.selectDbProfile(dbPath);
        renderDbProfiles();
        await refreshBoard();
        await loadAnalytics();
        await loadCalendar();
        if (document.getElementById("tab-backlog")?.classList.contains("active")) {
          await loadBacklog();
        }
        if (document.getElementById("tab-archive")?.classList.contains("active")) {
          await loadArchive();
        }
        showToast(state.language === "ru" ? "База данных переключена" : "Database switched");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  els.saveSettingsBtn.addEventListener("click", async () => {
    const startRaw = String(els.settingsWorkdayStart?.value || "").trim();
    const endRaw = String(els.settingsWorkdayEnd?.value || "").trim();
    let workdayStart = startRaw ? normalizeTimeValue(startRaw, "") : "";
    let workdayEnd = endRaw ? normalizeTimeValue(endRaw, "") : "";
    const startMinutes = parseTimeToMinutes(workdayStart);
    const endMinutes = parseTimeToMinutes(workdayEnd);
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      workdayEnd = normalizeTimeValue(formatMinutesAsTime(Math.min(23 * 60 + 59, startMinutes + 60)), "");
    }
    const patch = {
      workMinutes: String(Math.max(1, Number(els.settingsWorkMinutes.value || 25))),
      shortBreakMinutes: String(Math.max(1, Number(els.settingsShortBreak.value || 5))),
      longBreakMinutes: String(Math.max(1, Number(els.settingsLongBreak.value || 30))),
      workdayStart,
      workdayEnd,
      kanbanProcessView: els.settingsKanbanProcessView?.value === "process" ? "process" : "today",
      theme: els.settingsTheme.value,
      language: els.settingsLanguage.value,
      timerTickingEnabled: els.settingsTickingEnabled?.checked ? "1" : "0",
      markdownExtendedEnabled: els.settingsMarkdownExtendedEnabled?.checked ? "1" : "0"
    };

    try {
      const updated = await api.updateSettings(patch);
      state.settings = updated;
      applySettingsToForm();
      showToast(state.language === "ru" ? "Настройки сохранены" : "Settings saved");
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function init() {
  bindEvents();
  bindViewportListeners();
  applyTranslations();
  bindSystemThemeListener();
  renderTaskColorPalette();

  try {
    state.settings = await api.getSettings();
    applySettingsToForm();
    await loadDbProfiles();
    await refreshBoard();
    await recoverInterruptedPomodoroAfterCrash();
    if (state.timer.running || hasActivePomodoroTask()) {
      setActiveTab("pomodoro");
    }
    await loadAnalytics();
    await loadCalendar();
    await autoStartScheduledTaskIfDue();
  } catch (error) {
    showToast(error.message);
  }

  clearTaskForm();
  pushTimerRuntimeState();
  setInterval(() => {
    updateTodayNowIndicator();
    void autoStartScheduledTaskIfDue();
  }, 15 * 1000);
}

void init();
