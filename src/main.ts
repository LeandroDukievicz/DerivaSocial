// DerivaSocial — main process do Electron.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import * as store from "./store";
import * as thumbnail from "./thumbnail";
import * as secrets from "./secrets";
import * as linkedin from "./linkedin";
import * as instagram from "./instagram";
import * as threads from "./threads";

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
const REDES_IMPLEMENTADAS = ["linkedin", "instagram", "threads"];

async function publishToNetwork(post: store.Post, network: string, text: string): Promise<{ url?: string }> {
  if (network === "linkedin") return linkedin.publish(post, text);
  if (network === "instagram") return instagram.publish(post, text);
  if (network === "threads") return threads.publish(post, text);
  throw new Error(`Rede "${network}" ainda não implementada (falta o app/token dela).`);
}

ipcMain.handle("linkedin:status", () => linkedin.status());
ipcMain.handle("linkedin:connect", () => linkedin.connect());
ipcMain.handle("instagram:status", () => instagram.status());
ipcMain.handle("threads:status", () => threads.status());
ipcMain.handle("publish", async (_event, payload: { guid: string; network: string; text: string }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post não encontrado.");
  const prev = post.networks?.[payload.network];
  if (prev?.status === "published") return { url: prev.url, already: true };
  const out = await publishToNetwork(post, payload.network, payload.text);
  await store.markPublished(post.guid, payload.network, out.url);
  return { url: out.url };
});

// ---- Agendamento ----
ipcMain.handle("schedule:set", async (_event, payload: { guid: string; at: string; text: string; networks: string[] }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post não encontrado.");
  const networks = (payload.networks || []).filter((n) => REDES_IMPLEMENTADAS.includes(n));
  if (!networks.length) throw new Error("Selecione ao menos uma rede disponível.");
  if (!payload.text?.trim()) throw new Error("O texto não pode ficar vazio.");
  const at = new Date(payload.at);
  if (isNaN(at.getTime())) throw new Error("Data/hora inválida.");
  return store.setSchedule(post.guid, {
    at: at.toISOString(),
    text: payload.text.trim(),
    networks,
    status: "pending",
  });
});
ipcMain.handle("schedule:cancel", async (_event, guid: string) => store.setSchedule(guid, null));

// Scheduler: checa a cada 30s; dispara agendamentos vencidos publicando nas redes EM PARALELO.
// Se o app estava fechado no horário, dispara na próxima abertura (catch-up).
const emExecucao = new Set<string>();

async function checkSchedules(): Promise<void> {
  const posts = await store.getPosts();
  for (const p of posts) {
    const s = p.schedule;
    if (!s || s.status !== "pending" || emExecucao.has(p.guid)) continue;
    if (Date.parse(s.at) > Date.now()) continue;
    emExecucao.add(p.guid);
    runSchedule(p).catch((e) => console.error("[agenda]", e)).finally(() => emExecucao.delete(p.guid));
  }
}

async function runSchedule(p: store.Post): Promise<void> {
  const s = p.schedule!;
  const alvos = s.networks.filter((n) => p.networks?.[n]?.status !== "published");
  console.log(`[agenda] disparando "${p.title}" → ${alvos.join(", ")}`);

  const resultados = await Promise.allSettled(
    alvos.map(async (n) => {
      const out = await publishToNetwork(p, n, s.text);
      await store.markPublished(p.guid, n, out.url);
      return n;
    }),
  );

  const ok: string[] = [];
  const falhas: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push(alvos[i]);
    else falhas.push(`${alvos[i]}: ${(r.reason as Error)?.message ?? r.reason}`);
  });

  await store.setSchedule(p.guid, {
    ...s,
    status: falhas.length ? "error" : "done",
    result: [ok.length ? `✅ ${ok.join(", ")}` : "", falhas.length ? `❌ ${falhas.join(" · ")}` : ""]
      .filter(Boolean)
      .join("  "),
  });
  win?.webContents.send("posts-updated");
  console.log(`[agenda] "${p.title}": ${falhas.length ? "com falhas" : "publicado"}`);
}

app.whenReady().then(async () => {
  const dataDir = app.getPath("userData");
  store.init(dataDir);
  thumbnail.init(dataDir);
  await secrets.init(dataDir, app.getAppPath());
  instagram.maybeRefreshToken().catch((e) => console.error("refresh IG:", e));
  threads.maybeRefreshToken().catch((e) => console.error("refresh Threads:", e));
  await store.refreshPosts().catch((e) => console.error("refresh inicial:", e));
  // Poll de hora em hora
  setInterval(() => store.refreshPosts().catch((e) => console.error(e)), HORA_MS);
  // Agendamentos: catch-up na abertura + checagem a cada 30s
  checkSchedules().catch((e) => console.error(e));
  setInterval(() => checkSchedules().catch((e) => console.error(e)), 30_000);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
