// Ingestão de posts do blog (via RSS) + persistência em JSON. Roda no main process (Node).
import { promises as fs } from "node:fs";
import * as path from "node:path";

const RSS_URL = process.env.RSS_URL ?? "https://devsaderiva.com.br/rss.xml";

export type Status = "novo" | "publicado" | "ignorado";

export interface Post {
  guid: string;
  title: string;
  url: string;
  image?: string;
  summary: string;
  category?: string;
  publishedAt?: string;
  discoveredAt: string;
  status: Status;
  networks: Record<string, { status: string; url?: string }>;
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
  post.status = "publicado";
  await save(data);
  return post;
}

export async function getStats() {
  const posts = await getPosts();
  return {
    total: posts.length,
    novos: posts.filter((p) => p.status === "novo").length,
    publicados: posts.filter((p) => p.status === "publicado").length,
  };
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
    if (!it.guid || data[it.guid]) continue;
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
