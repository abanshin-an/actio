const { contextBridge, ipcRenderer } = require('electron');

async function invoke(channel, payload = {}) {
  const result = await ipcRenderer.invoke(channel, payload);
  if (!result?.ok) {
    throw new Error(result?.error || 'IPC request failed');
  }
  return result.data;
}

const api = {
  loadBoard: (filters) => invoke('board:load', filters || {}),

  createColumn: (title) => invoke('columns:create', { title }),
  deleteColumn: (columnId) => invoke('columns:delete', { columnId }),
  reorderColumns: (orderedIds) => invoke('columns:reorder', { orderedIds }),

  listProjects: () => invoke('projects:list'),
  createProject: (name) => invoke('projects:create', { name }),

  listCategories: () => invoke('categories:list'),
  createCategory: (name) => invoke('categories:create', { name }),

  createTask: (payload) => invoke('tasks:create', payload),
  updateTask: (taskId, patch) => invoke('tasks:update', { taskId, patch }),
  deleteTask: (taskId) => invoke('tasks:delete', { taskId }),
  moveTask: (taskId, toColumnId) => invoke('tasks:move', { taskId, toColumnId }),
  reorderTasks: (columnId, orderedTaskIds) => invoke('tasks:reorder', { columnId, orderedTaskIds }),
  getTask: (taskId) => invoke('tasks:get', { taskId }),
  setActiveTask: (taskId) => invoke('tasks:set-active', { taskId }),
  clearActiveTask: (taskId) => invoke('tasks:clear-active', { taskId }),
  completeTask: (taskId) => invoke('tasks:complete', { taskId }),
  interruptTask: (taskId) => invoke('tasks:interrupt', { taskId }),
  incrementTaskSpent: (taskId, amount = 1, source = 'manual') =>
    invoke('tasks:increment-spent', { taskId, amount, source }),
  addToBacklog: (taskId) => invoke('backlog:add', { taskId }),
  listBacklog: (filters) => invoke('backlog:list', { filters }),
  moveFromBacklog: (taskId, toColumnId) => invoke('backlog:move', { taskId, toColumnId }),

  addTodoTxt: (line) => invoke('todotxt:add', { line }),

  recordPomodoroSession: (payload) => invoke('pomodoro:record', payload),
  listCalendarSessions: (from, to) => invoke('calendar:sessions', { from, to }),
  listCalendarScheduled: (from, to) => invoke('calendar:scheduled', { from, to }),

  getSettings: () => invoke('settings:get'),
  updateSettings: (patch) => invoke('settings:update', { patch }),
  listDbProfiles: () => invoke('db:profiles:list'),
  chooseDbProfilePath: () => invoke('db:profiles:choose-path'),
  addDbProfile: (dbPath) => invoke('db:profiles:add', { dbPath }),
  createEmptyDbProfile: (dbPath) => invoke('db:profiles:create-empty', { dbPath }),
  selectDbProfile: (dbPath) => invoke('db:profiles:select', { dbPath }),
  getStartupState: () => invoke('app:startup-state'),

  getAnalytics: (filters) => invoke('analytics:get', { filters }),
  listArchive: (filters) => invoke('archive:list', { filters }),
  cloneArchiveToInbox: (archiveId) => invoke('archive:clone-to-inbox', { archiveId }),
  deleteArchive: (archiveId) => invoke('archive:delete', { archiveId }),
  openExternal: (url) => invoke('shell:open-external', { url }),

  updateTimerState: (payload) => ipcRenderer.send('timer:state', payload || {}),
  onShutdownInterruptRequest: (handler) => {
    const listener = async () => {
      try {
        if (typeof handler === 'function') {
          await handler();
        }
      } finally {
        ipcRenderer.send('app:shutdown-interrupt-complete');
      }
    };

    ipcRenderer.on('app:shutdown-interrupt', listener);
    return () => ipcRenderer.removeListener('app:shutdown-interrupt', listener);
  }
};

contextBridge.exposeInMainWorld('api', api);
