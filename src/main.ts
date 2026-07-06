// DerivaSocial — main process do Electron.
import { app, BrowserWindow, ipcMain, shell } from "electron";
import * as path from "node:path";
import * as store from "./store";
import * as thumbnail from "./thumbnail";
import * as secrets from "./secrets";
import * as linkedin from "./linkedin";
import * as instagram from "./instagram";
import * as threads from "./threads";
import * as upcoming from "./upcoming";

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

// Avisa todas as janelas que os posts mudaram (menos a que originou a ação,
// que já se atualiza sozinha no próprio fluxo).
function broadcastPostsUpdated(except?: Electron.WebContents): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && w.webContents !== except) w.webContents.send("posts-updated");
  }
}

// Janela de detalhe do post (uma por post; clicar de novo só foca a existente)
const detailWins = new Map<string, BrowserWindow>();

function openPostWindow(guid: string): void {
  const existing = detailWins.get(guid);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const w = new BrowserWindow({
    width: 1000,
    height: 840,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#010212",
    title: "DerivaSocial",
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  w.setMenuBarVisibility(false);
  w.loadFile(path.join(app.getAppPath(), "renderer", "post.html"), { query: { guid } });
  detailWins.set(guid, w);
  w.on("closed", () => detailWins.delete(guid));
}

// Rotas de dados (IPC) — o renderer chama via window.api.*
ipcMain.handle("posts", () => store.getPosts());
ipcMain.handle("stats", () => store.getStats());
ipcMain.handle("refresh", async () => {
  await syncRadar();
  return store.refreshPosts();
});
ipcMain.handle("post:read", async (event, guid: string) => {
  const r = await store.markRead(guid);
  broadcastPostsUpdated(event.sender);
  return r;
});
ipcMain.handle("post:unread", async (event, guid: string) => {
  const r = await store.markUnread(guid);
  broadcastPostsUpdated(event.sender);
  return r;
});
ipcMain.handle("post:open-window", (_event, guid: string) => openPostWindow(guid));
ipcMain.handle("open:external", (_event, url: string) => {
  if (!/^https:\/\//i.test(url)) throw new Error("Só abro links https.");
  return shell.openExternal(url);
});
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

// ---- Radar do blog (posts agendados no dashboard) ----
async function syncRadar(): Promise<void> {
  if (!upcoming.configured()) return; // sem host no keys.txt, o radar fica desligado
  try {
    await store.syncUpcoming(await upcoming.fetchUpcoming());
  } catch (e) {
    console.warn("[radar] falha ao consultar o banco do blog:", (e as Error).message);
  }
}

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
ipcMain.handle("publish", async (event, payload: { guid: string; network: string; text: string }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post não encontrado.");
  if (post.upcoming) {
    const quando = post.blogScheduledAt ? new Date(post.blogScheduledAt).toLocaleString("pt-BR") : "em breve";
    throw new Error(`Este post ainda não está no ar — entra no blog em ${quando}. Agende o disparo para depois desse horário.`);
  }
  const prev = post.networks?.[payload.network];
  if (prev?.status === "published") return { url: prev.url, already: true };
  const out = await publishToNetwork(post, payload.network, payload.text);
  await store.markPublished(post.guid, payload.network, out.url);
  broadcastPostsUpdated(event.sender);
  return { url: out.url };
});

// ---- Agendamento ----
ipcMain.handle("schedule:set", async (event, payload: { guid: string; at: string; text: string; networks: string[] }) => {
  const post = await store.getPost(payload.guid);
  if (!post) throw new Error("Post não encontrado.");
  const networks = (payload.networks || []).filter((n) => REDES_IMPLEMENTADAS.includes(n));
  if (!networks.length) throw new Error("Selecione ao menos uma rede disponível.");
  if (!payload.text?.trim()) throw new Error("O texto não pode ficar vazio.");
  const at = new Date(payload.at);
  if (isNaN(at.getTime())) throw new Error("Data/hora inválida.");
  if (post.upcoming && post.blogScheduledAt && at.getTime() <= Date.parse(post.blogScheduledAt)) {
    throw new Error(
      `O post só entra no blog em ${new Date(post.blogScheduledAt).toLocaleString("pt-BR")} — agende o disparo para DEPOIS disso.`,
    );
  }
  const r = await store.setSchedule(post.guid, {
    at: at.toISOString(),
    text: payload.text.trim(),
    networks,
    status: "pending",
  });
  broadcastPostsUpdated(event.sender);
  return r;
});
ipcMain.handle("schedule:cancel", async (event, guid: string) => {
  const r = await store.setSchedule(guid, null);
  broadcastPostsUpdated(event.sender);
  return r;
});

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

async function runSchedule(post: store.Post): Promise<void> {
  let p = post;
  if (p.upcoming) {
    // o post do blog ainda não saiu — confere o RSS antes de disparar; se atrasou, espera o próximo ciclo
    await store.refreshPosts().catch(() => {});
    const fresh = await store.getPost(p.guid);
    if (!fresh || fresh.upcoming) {
      console.log(`[agenda] "${p.title}": segurando o disparo — o post ainda não entrou no ar no blog`);
      return;
    }
    p = fresh;
  }
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
  broadcastPostsUpdated();
  console.log(`[agenda] "${p.title}": ${falhas.length ? "com falhas" : "publicado"}`);
}

app.whenReady().then(async () => {
  const dataDir = app.getPath("userData");
  store.init(dataDir);
  thumbnail.init(dataDir);
  await secrets.init(dataDir, app.getAppPath());
  instagram.maybeRefreshToken().catch((e) => console.error("refresh IG:", e));
  threads.maybeRefreshToken().catch((e) => console.error("refresh Threads:", e));
  await syncRadar();
  await store.refreshPosts().catch((e) => console.error("refresh inicial:", e));
  // Poll de hora em hora (radar do blog + RSS)
  setInterval(() => syncRadar().then(() => store.refreshPosts()).catch((e) => console.error(e)), HORA_MS);
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
