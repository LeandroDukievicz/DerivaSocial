// Segredos (client ids, tokens) — salvos em userData/secrets.json, NUNCA no repo.
// Conveniência de dev: importa Client ID/Secret de keys.txt (gitignored) se existir.
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

interface Secrets {
  linkedin: LinkedInSecrets;
}

let file = "";
let cache: Secrets = { linkedin: {} };

export async function init(dataDir: string, appRoot: string): Promise<void> {
  file = path.join(dataDir, "secrets.json");
  try {
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    cache = { linkedin: {}, ...raw };
  } catch {
    cache = { linkedin: {} };
  }
  await importKeysTxt([
    path.join(dataDir, "keys.txt"),
    path.join(appRoot, "src", "keys.txt"),
    path.join(appRoot, "keys.txt"),
  ]);
}

/** Lê o primeiro keys.txt que existir e importa client id/secret do LinkedIn. */
async function importKeysTxt(candidates: string[]): Promise<void> {
  for (const p of candidates) {
    let txt = "";
    try {
      txt = await fs.readFile(p, "utf8");
    } catch {
      continue;
    }
    const id = valueOfLine(txt, /client\s*id/i);
    const secret = valueOfLine(txt, /secret/i);
    if (id && id !== cache.linkedin.clientId) cache.linkedin.clientId = id;
    if (secret && secret !== cache.linkedin.clientSecret) cache.linkedin.clientSecret = secret;
    if (id || secret) await save();
    return;
  }
}

function valueOfLine(txt: string, re: RegExp): string {
  for (const line of txt.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0 && re.test(line.slice(0, i))) return line.slice(i + 1).trim();
  }
  return "";
}

export function linkedin(): LinkedInSecrets {
  return cache.linkedin;
}

export async function save(): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(cache, null, 2));
}
