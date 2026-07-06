// Hospedagem das thumbs sociais — IG/Threads só aceitam imagem por URL pública,
// então a thumb gerada (PNG local) sobe pro VPS por SSH e o Caddy serve em
// https://devsaderiva.com.br/social/ (pasta isolada, sem relação com o blog).
// O host SSH fica no keys.txt (seção "vps", gitignored) — nunca no código.
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import * as path from "node:path";
import * as secrets from "./secrets";

const REMOTE_DIR = "/var/www/social";
const PUBLIC_BASE = "https://devsaderiva.com.br/social";

export function configured(): boolean {
  return !!secrets.vps().host;
}

/** Envia a thumb pro VPS e retorna a URL pública dela. */
export async function uploadThumb(localPath: string): Promise<string> {
  const host = secrets.vps().host;
  if (!host) throw new Error("Host do VPS não configurado (seção vps do keys.txt).");
  const name = path.basename(localPath).replace(/[^a-zA-Z0-9._-]/g, "");
  if (!name) throw new Error("Nome de arquivo inválido.");
  await sshRun(host, `cat > ${REMOTE_DIR}/${name} && chmod 644 ${REMOTE_DIR}/${name}`, localPath);
  return `${PUBLIC_BASE}/${name}`;
}

/**
 * Faxina: apaga do servidor thumbs com mais de 60 dias (só pra liberar espaço).
 * Seguro: IG/Threads/LinkedIn COPIAM a imagem ao publicar — apagar a origem não
 * afeta nada já publicado. 60 dias dá folga pra qualquer agendamento pendente.
 */
export async function cleanupOld(): Promise<void> {
  const host = secrets.vps().host;
  if (!host) return;
  try {
    await sshRun(host, `find ${REMOTE_DIR} -type f -mtime +60 -delete`);
  } catch (e) {
    console.warn("[socialimg] faxina das thumbs falhou:", (e as Error).message);
  }
}

/** Roda um comando no VPS via SSH, opcionalmente mandando um arquivo por stdin. */
function sshRun(host: string, cmd: string, stdinFile?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, cmd]);
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Tempo esgotado enviando a thumb pro servidor."));
    }, 30_000);
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ssh código ${code}: ${err.slice(0, 300)}`));
    });
    if (stdinFile) createReadStream(stdinFile).pipe(child.stdin);
    else child.stdin.end();
  });
}
