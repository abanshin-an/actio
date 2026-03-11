import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow, app, dialog, ipcMain, screen } from "electron";

let mainWindow = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ipcMain.handle("client:choose-db-path", async () => {
  const result = await dialog.showSaveDialog(mainWindow || undefined, {
    title: "Выберите путь файла БД",
    defaultPath: path.join(app.getPath("appData"), "actio", "actio.sqlite"),
    filters: [{ name: "SQLite", extensions: ["sqlite", "db"] }, { name: "All files", extensions: ["*"] }]
  });
  if (result.canceled) return "";
  return String(result.filePath || "");
});

function createWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = display?.workArea || { x: 0, y: 0, width: 1460, height: 920 };
  const width = Math.max(1280, Math.min(2200, workArea.width - 24));
  const height = Math.max(720, Math.min(1400, workArea.height - 24));
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);
  const targetUrl = process.env.ACTIO_WEB_URL || "http://127.0.0.1:3010";

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
      sandbox: true,
      preload: path.join(__dirname, "client-preload.cjs")
    }
  });

  mainWindow.loadURL(targetUrl);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
