// DerivaSocial — main process do Electron.
import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import * as store from "./store";

const HORA_MS = 60 * 60 * 1000;
let win: BrowserWindow | null = null;

function iconPath(): string {
  const file = process.platform === "win32" ? "derivasocial.ico" : "derivasocial-256.png";
  return path.join(app.getAppPath(), "assets", file);
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#010212",
    title: "DerivaSocial",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(app.getAppPath(), "renderer", "index.html"));
  win.on("closed", () => (win = null));
}

// Rotas de dados (IPC) — o renderer chama via window.api.*
ipcMain.handle("posts", () => store.getPosts());
ipcMain.handle("stats", () => store.getStats());
ipcMain.handle("refresh", () => store.refreshPosts());

app.whenReady().then(async () => {
  store.init(app.getPath("userData"));
  await store.refreshPosts().catch((e) => console.error("refresh inicial:", e));
  // Poll de hora em hora
  setInterval(() => store.refreshPosts().catch((e) => console.error(e)), HORA_MS);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
