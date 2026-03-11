const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronClient", {
  chooseDbProfilePath: () => ipcRenderer.invoke("client:choose-db-path")
});
