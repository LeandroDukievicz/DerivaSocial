// Segredos (client ids, tokens) — salvos em userData/secrets.json, NUNCA no repo.
// Conveniência de dev: importa credenciais de keys.txt (gitignored), organizado em seções:
//   linkedin / instagram / threads, com linhas "chave : valor".
import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface LinkedInSecrets {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  expiresAt?: string; // ISO
  personUrn?: string; // urn:li:person:{sub}
  name?: string;
}

export interface InstagramSecrets {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  userId?: string;
  username?: string;
  expiresAt?: string; // ISO
  refreshedAt?: string; // ISO — última renovação do token
}

export interface ThreadsSecrets {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  userId?: string;
  username?: string;
  expiresAt?: string;
  refreshedAt?: string;
}

export interface VpsSecrets {
  host?: string; // ex.: root@IP — usado pelo radar de posts agendados (nunca commitar o IP)
}

interface Secrets {
  linkedin: LinkedInSecrets;
  instagram: InstagramSecrets;
  threads: ThreadsSecrets;
  vps: VpsSecrets;
}

let file = "";
let cache: Secrets = { linkedin: {}, instagram: {}, threads: {}, vps: {} };

export async function init(dataDir: string, appRoot: string): Promise<void> {
  file = path.join(dataDir, "secrets.json");
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    cache = { linkedin: {}, instagram: {}, threads: {}, vps: {}, ...raw };
  } catch {
    cache = { linkedin: {}, instagram: {}, threads: {}, vps: {} };
  }
  await importKeysTxt([
    path.join(dataDir, "keys.txt"),
    path.join(appRoot, "src", "keys.txt"),
    path.join(appRoot, "keys.txt"),
  ]);
}

/** Lê o primeiro keys.txt que existir e importa as credenciais por seção. */
async function importKeysTxt(candidates: string[]): Promise<void> {
  for (const p of candidates) {
    let txt = "";
    try {
      txt = await fs.readFile(p, "utf8");
    } catch {
      continue;
    }
    parseKeys(txt);
    await save();
    return;
  }
}

function parseKeys(txt: string): void {
  let section = "";
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) {
      const s = line.toLowerCase();
      if (s.startsWith("linkedin")) section = "linkedin";
      else if (s.startsWith("instagram")) section = "instagram";
      else if (s.startsWith("threads")) section = "threads";
      else if (s.startsWith("vps") || s.startsWith("servidor")) section = "vps";
      continue;
    }
    const key = line.slice(0, i).toLowerCase();
    const value = line.slice(i + 1).trim();
    if (!value) continue;

    if (section === "linkedin") {
      if (/client\s*id/.test(key)) cache.linkedin.clientId = value;
      else if (/secret|secreta/.test(key)) cache.linkedin.clientSecret = value;
    } else if (section === "instagram" || section === "threads") {
      const tgt = cache[section as "instagram" | "threads"];
      if (/id/.test(key) && /app/.test(key)) tgt.appId = value;
      else if (/secret|secreta/.test(key)) tgt.appSecret = value;
      else if (/token/.test(key)) {
        // token novo no keys.txt substitui o salvo (permite recolar manualmente)
        if (tgt.accessToken !== value) {
          tgt.accessToken = value;
          tgt.expiresAt = undefined;
          tgt.refreshedAt = undefined;
        }
      } else if (/conta|user|@/.test(key)) tgt.username = value.replace(/^@/, "");
    } else if (section === "vps") {
      if (/host|ssh/.test(key)) cache.vps.host = value;
    }
  }
}

export function linkedin(): LinkedInSecrets {
  return cache.linkedin;
}
export function instagram(): InstagramSecrets {
  return cache.instagram;
}
export function threads(): ThreadsSecrets {
  return cache.threads;
}
export function vps(): VpsSecrets {
  return cache.vps;
}

export async function save(): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(cache, null, 2));
}
