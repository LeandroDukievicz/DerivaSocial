// Ingestão de posts do blog (via RSS) + persistência em JSON. Roda no main process (Node).
import { promises as fs } from "node:fs";
import * as path from "node:path";

const RSS_URL = process.env.RSS_URL ?? "https://devsaderiva.com.br/rss.xml";

export type Status = "novo" | "agendado" | "publicado" | "lido" | "ignorado";

export interface Schedule {
  at: string; // ISO — quando disparar
  text: string; // legenda usada em todas as redes
  networks: string[]; // redes-alvo (dispara em paralelo)
  status: "pending" | "done" | "error";
  result?: string; // resumo pós-execução (sucessos/falhas)
}

export interface Post {
  guid: string;
  title: string;
  url: string;
  image?: string;
  summary: string;
  category?: string;
  publishedAt?: string;
  discoveredAt: string;
  readAt?: string;
  upcoming?: boolean; // ainda não está no ar — só agendado no dashboard do blog
  blogScheduledAt?: string; // ISO UTC — quando o post entra no ar no blog
  status: Status;
  networks: Record<string, { status: string; url?: string }>;
  schedule?: Schedule;
}

// Definido pelo main via init() para gravar em app.getPath("userData").
let dataFile = path.join(process.cwd(), "data", "posts.json");

export function init(dataDir: string): void {
  dataFile = path.join(dataDir, "posts.json");
}

async function load(): Promise<Record<string, Post>> {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch {
    return {};
  }
}

async function save(data: Record<string, Post>): Promise<void> {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

export async function getPosts(): Promise<Post[]> {
  const data = await load();
  return Object.values(data).sort((a, b) => (a.discoveredAt < b.discoveredAt ? 1 : -1));
}

export async function getPost(guid: string): Promise<Post | null> {
  const data = await load();
  return data[guid] || null;
}

/** Marca um post como publicado numa rede (e o post como "publicado"). */
export async function markPublished(guid: string, network: string, url?: string): Promise<Post | null> {
  const data = await load();
  const post = data[guid];
  if (!post) return null;
  post.networks[network] = { status: "published", url };
  if (post.status !== "lido") post.status = "publicado";
  await save(data);
  return post;
}

/** Marca um post como lido/arquivado. */
export async function markRead(guid: string): Promise<Post | null> {
  const data = await load();
  const post = data[guid];
  if (!post) return null;
  post.status = "lido";
  post.readAt = new Date().toISOString();
  await save(data);
  return post;
}

/** Restaura um post arquivado para a lista ativa. */
export async function markUnread(guid: string): Promise<Post | null> {
  const data = await load();
  const post = data[guid];
  if (!post) return null;
  const jaPublicou = Object.values(post.networks || {}).some((n) => n.status === "published");
  post.status = post.schedule?.status === "pending" ? "agendado" : jaPublicou ? "publicado" : "novo";
  post.readAt = undefined;
  await save(data);
  return post;
}

/** Define/atualiza/remove o agendamento de um post (e ajusta o status). */
export async function setSchedule(guid: string, schedule: Schedule | null): Promise<Post | null> {
  const data = await load();
  const post = data[guid];
  if (!post) return null;
  post.schedule = schedule ?? undefined;
  const jaPublicou = Object.values(post.networks || {}).some((n) => n.status === "published");
  if (post.status !== "lido") {
    post.status = schedule?.status === "pending" ? "agendado" : jaPublicou ? "publicado" : "novo";
  }
  await save(data);
  return post;
}

export async function getStats() {
  const posts = await getPosts();
  const ativos = posts.filter((p) => p.status !== "lido");
  return {
    total: posts.length,
    novos: ativos.filter((p) => p.status === "novo" && !p.upcoming).length,
    chegando: posts.filter((p) => p.upcoming).length,
    agendados: ativos.filter((p) => p.status === "agendado").length,
    publicados: ativos.filter((p) => p.status === "publicado").length,
    arquivados: posts.filter((p) => p.status === "lido").length,
  };
}

const BLOG_URL = "https://devsaderiva.com.br";

/** Radar: registra/atualiza posts AGENDADOS no blog (vindos do banco do dashboard).
 *  O guid usa a mesma URL do RSS, então quando o post publicar ele vira o MESMO registro. */
export async function syncUpcoming(
  list: { slug: string; title: string; excerpt: string; image?: string; category?: string; blogScheduledAt: string }[],
): Promise<number> {
  const data = await load();
  const naAgenda = new Set<string>();
  let novos = 0;
  for (const u of list) {
    const guid = `${BLOG_URL}/posts/${u.slug}`;
    naAgenda.add(guid);
    const post = data[guid];
    if (!post) {
      data[guid] = {
        guid,
        title: u.title,
        url: guid,
        image: u.image,
        summary: (u.excerpt || "").slice(0, 300),
        category: u.category,
        discoveredAt: new Date().toISOString(),
        upcoming: true,
        blogScheduledAt: u.blogScheduledAt,
        status: "novo",
        networks: {},
      };
      novos++;
    } else if (post.upcoming) {
      // dados editáveis no dashboard podem mudar até a publicação (inclusive o horário)
      post.title = u.title;
      post.image = u.image ?? post.image;
      post.summary = (u.excerpt || post.summary).slice(0, 300);
      post.category = u.category ?? post.category;
      post.blogScheduledAt = u.blogScheduledAt;
    }
  }
  // Saiu da agenda do blog sem publicar (cancelado/voltou a rascunho): tira do radar,
  // a menos que já exista agendamento social — aí fica e o scheduler segura o disparo.
  for (const p of Object.values(data)) {
    if (p.upcoming && !naAgenda.has(p.guid) && !p.schedule) delete data[p.guid];
  }
  await save(data);
  if (novos) console.log(`[radar] ${novos} post(s) agendado(s) no blog entraram no painel`);
  return novos;
}

/** Bate no RSS, registra posts novos (dedup por guid). Retorna quantos novos. */
export async function refreshPosts(): Promise<number> {
  const res = await fetch(RSS_URL, { headers: { "user-agent": "derivasocial" } });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  const xml = await res.text();
  const items = extractItems(xml);
  const data = await load();
  let novos = 0;
  for (const it of items) {
    if (!it.guid) continue;
    const existente = data[it.guid];
    if (existente) {
      if (existente.upcoming) {
        // o post do radar entrou no ar — completa com os dados reais do RSS
        existente.upcoming = false;
        existente.title = it.title || existente.title;
        existente.url = it.link || existente.url;
        existente.image = it.image || existente.image;
        existente.summary = (it.description || existente.summary).slice(0, 300);
        existente.category = it.category || existente.category;
        existente.publishedAt = it.pubDate || undefined;
        console.log(`[radar] post entrou no ar no blog: ${existente.title}`);
      }
      continue;
    }
    data[it.guid] = {
      guid: it.guid,
      title: it.title || "(sem título)",
      url: it.link,
      image: it.image || undefined,
      summary: it.description.slice(0, 300),
      category: it.category || undefined,
      publishedAt: it.pubDate || undefined,
      discoveredAt: new Date().toISOString(),
      status: "novo",
      networks: {},
    };
    novos++;
  }
  await save(data);
  console.log(`[rss] ${items.length} itens no feed · ${novos} novo(s)`);
  return novos;
}

// ---------- parser mínimo de RSS 2.0 (sem dependências) ----------
interface RawItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image: string;
  category: string;
}

function extractItems(xml: string): RawItem[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((m) => {
    const b = m[0];
    return {
      guid: tag(b, "guid") || tag(b, "link"),
      title: decode(tag(b, "title")),
      link: tag(b, "link"),
      description: decode(tag(b, "description")),
      pubDate: tag(b, "pubDate"),
      image: attr(b, "enclosure", "url"),
      category: decode(tag(b, "category")),
    };
  });
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripCdata(m[1]).trim() : "";
}
function attr(block: string, tagName: string, attrName: string): string {
  const m = block.match(new RegExp(`<${tagName}[^>]*\\b${attrName}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}
function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}
function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
