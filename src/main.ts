// DerivaSocial — main process do Electron.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import * as store from "./store";
import * as thumbnail from "./thumbnail";
import * as secrets from "./secrets";
import * as linkedin from "./linkedin";

// Mesmo nome em dev e empacotado => mesmo userData (~/.config/DerivaSocial),
// compartilhando posts.json e secrets.json entre `npm start` e o app instalado.
app.setName("DerivaSocial");

const HORA_MS = 60 * 60 * 1000;
let win: BrowserWindow | null = null;

function iconPath(): string {
  const file = process.platform === "win32" ? "capacete-de-astronauta.ico" : "capacete-de-astronauta-256.png";
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
ipcMain.handle("thumbnail:suggestions", async (_event, guid: string) => {
  const post = await store.getPost(guid);
  if (!post) throw new Error("Post nao encontrado.");
  return thumbnail.suggestTexts(post);
});
ipcMain.handle("thumbnail:generate", async (_event, payload: { guid: string; text: string; format?: thumbnail.ThumbnailFormat }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post nao encontrado.");
  return thumbnail.generate(post, { text: payload.text, format: payload.format });
});
ipcMain.handle("thumbnail:show", async (_event, filePath: string) => {
  if (!thumbnail.isManagedPath(filePath)) throw new Error("Arquivo fora da pasta de thumbnails.");
  shell.showItemInFolder(filePath);
});

// ---- Redes sociais ----
ipcMain.handle("linkedin:status", () => linkedin.status());
ipcMain.handle("linkedin:connect", () => linkedin.connect());
ipcMain.handle("publish", async (_event, payload: { guid: string; network: string; text: string }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post não encontrado.");
  const prev = post.networks?.[payload.network];
  if (prev?.status === "published") return { url: prev.url, already: true };

  if (payload.network === "linkedin") {
    const out = await linkedin.publish(post, payload.text);
    await store.markPublished(post.guid, "linkedin", out.url);
    return { url: out.url };
  }
  throw new Error(`Rede "${payload.network}" ainda não implementada (falta o app/token dela).`);
});

app.whenReady().then(async () => {
  const dataDir = app.getPath("userData");
  store.init(dataDir);
  thumbnail.init(dataDir);
  await secrets.init(dataDir, app.getAppPath());
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
