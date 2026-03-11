(function initWebApiBridge() {
  if (typeof window === "undefined") return;
  if (window.api) return;

  const base = window.ACTIO_API_BASE || "";

  async function invoke(channel, payload) {
    const response = await fetch(`${base}/api/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, payload: payload || {} })
    });
    const result = await response.json();
    if (!result?.ok) {
      throw new Error(result?.error || `Request failed: ${channel}`);
    }
    return result.data;
  }

  const canPickDbPath = typeof window.electronClient?.chooseDbProfilePath === "function";

  window.api = {
    loadBoard: (filters) => invoke("board:load", filters || {}),
    createColumn: (title) => invoke("columns:create", { title }),
    deleteColumn: (columnId) => invoke("columns:delete", { columnId }),
    reorderColumns: (orderedIds) => invoke("columns:reorder", { orderedIds }),
    listProjects: () => invoke("projects:list"),
    createProject: (name) => invoke("projects:create", { name }),
    listCategories: () => invoke("categories:list"),
    createCategory: (name) => invoke("categories:create", { name }),
    createTask: (payload) => invoke("tasks:create", payload),
    updateTask: (taskId, patch) => invoke("tasks:update", { taskId, patch }),
    deleteTask: (taskId) => invoke("tasks:delete", { taskId }),
    moveTask: (taskId, toColumnId) => invoke("tasks:move", { taskId, toColumnId }),
    reorderTasks: (columnId, orderedTaskIds) => invoke("tasks:reorder", { columnId, orderedTaskIds }),
    getTask: (taskId) => invoke("tasks:get", { taskId }),
    setActiveTask: (taskId) => invoke("tasks:set-active", { taskId }),
    clearActiveTask: (taskId) => invoke("tasks:clear-active", { taskId }),
    completeTask: (taskId) => invoke("tasks:complete", { taskId }),
    interruptTask: (taskId) => invoke("tasks:interrupt", { taskId }),
    incrementTaskSpent: (taskId, amount, source) =>
      invoke("tasks:increment-spent", { taskId, amount: amount || 1, source: source || "manual" }),
    addToBacklog: (taskId) => invoke("backlog:add", { taskId }),
    listBacklog: (filters) => invoke("backlog:list", { filters }),
    moveFromBacklog: (taskId, toColumnId) => invoke("backlog:move", { taskId, toColumnId }),
    addTodoTxt: (line) => invoke("todotxt:add", { line }),
    recordPomodoroSession: (payload) => invoke("pomodoro:record", payload),
    listCalendarSessions: (from, to) => invoke("calendar:sessions", { from, to }),
    listCalendarScheduled: (from, to) => invoke("calendar:scheduled", { from, to }),
    getSettings: () => invoke("settings:get"),
    updateSettings: (patch) => invoke("settings:update", { patch }),
    getSyncState: () => invoke("sync:get-state"),
    listDbProfiles: () => invoke("db:profiles:list"),
    ...(canPickDbPath
      ? {
          chooseDbProfilePath: async () => String((await window.electronClient.chooseDbProfilePath()) || "").trim()
        }
      : {}),
    addDbProfile: (dbPath) => invoke("db:profiles:add", { dbPath }),
    createEmptyDbProfile: (dbPath) => invoke("db:profiles:create-empty", { dbPath }),
    selectDbProfile: (dbPath) => invoke("db:profiles:select", { dbPath }),
    getStartupState: () => invoke("app:startup-state"),
    getAnalytics: (filters) => invoke("analytics:get", { filters }),
    listArchive: (filters) => invoke("archive:list", { filters }),
    cloneArchiveToInbox: (archiveId) => invoke("archive:clone-to-inbox", { archiveId }),
    deleteArchive: (archiveId) => invoke("archive:delete", { archiveId }),
    openExternal: async (url) => {
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return true;
    },
    updateTimerState: (payload) => {
      fetch(`${base}/api/timer-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {})
      }).catch(() => {});
    },
    onShutdownInterruptRequest: () => () => {}
  };
})();
