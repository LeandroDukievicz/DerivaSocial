// Threads — publicação via Threads API (graph.threads.net).
// Fluxo: criar container (TEXT ou IMAGE) -> aguardar processamento -> publicar -> obter permalink.
// Token: gerado no painel Meta (60 dias) e renovado automaticamente (th_refresh_token).
import * as secrets from "./secrets";
import * as imagefit from "./imagefit";
import type { Post } from "./store";

const G = "https://graph.threads.net/v1.0";
const TEXT_MAX = 500; // limite do Threads
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000; // renova 1x/semana

export interface ThreadsStatus {
  configured: boolean;
  username?: string;
  expiresAt?: string;
}

export function status(): ThreadsStatus {
  const s = secrets.threads();
  return {
    configured: !!s.accessToken,
    username: s.username,
    expiresAt: s.expiresAt,
  };
}

/** Renova o token de longa duração se a última renovação tiver mais de 7 dias. */
export async function maybeRefreshToken(): Promise<void> {
  const s = secrets.threads();
  if (!s.accessToken) return;
  const last = s.refreshedAt ? Date.parse(s.refreshedAt) : 0;
  if (Date.now() - last < REFRESH_EVERY_MS) return;
  try {
    const url = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(s.accessToken)}`;
    const res = await fetch(url);
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (res.ok && j.access_token) {
      s.accessToken = j.access_token;
      s.expiresAt = new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString();
      s.refreshedAt = new Date().toISOString();
      await secrets.save();
      console.log(`[threads] token renovado; expira ${s.expiresAt}`);
    } else {
      // token com <24h de vida ainda não renova — normal; tenta de novo no próximo ciclo
      console.warn(`[threads] refresh não aplicado: ${j.error?.message ?? res.status}`);
    }
  } catch (e) {
    console.warn("[threads] refresh falhou:", (e as Error).message);
  }
}

/** Garante que temos o user_id/username da conta (via /me). */
async function ensureUser(): Promise<string> {
  const s = secrets.threads();
  if (s.userId) return s.userId;
  const j = await api(`/me?fields=id,username`);
  s.userId = String(j.id);
  s.username = j.username ?? s.username;
  await secrets.save();
  return s.userId!;
}

/** Publica o post (imagem + texto, ou só texto). Retorna o permalink. */
export async function publish(post: Post, text: string): Promise<{ id: string; url?: string }> {
  const s = secrets.threads();
  if (!s.accessToken) throw new Error("Threads não configurado (token ausente no keys.txt).");

  const userId = await ensureUser();
  const body = text.slice(0, TEXT_MAX);

  // 1) container — com imagem se houver; imagefit resolve proporção fora do limite
  //    e conversão webp→jpg; sem imagem (ou se todas falharem), publica só o texto
  let creationId: string | undefined;
  if (post.image) {
    for (const u of await imagefit.candidates("threads", post.image)) {
      try {
        creationId = await createContainer(userId, body, u);
        break;
      } catch {
        /* tenta a próxima candidata */
      }
    }
  }
  if (!creationId) creationId = await createContainer(userId, body);

  // 2) aguarda o container ficar pronto (texto é instantâneo; imagem pode demorar)
  await waitContainer(creationId);

  // 3) publica
  const pub = await api(`/${userId}/threads_publish`, { creation_id: creationId });
  const mediaId = String(pub.id);

  // 4) permalink (não-fatal se falhar)
  let url: string | undefined;
  try {
    const info = await api(`/${mediaId}?fields=permalink`);
    url = info.permalink;
  } catch {
    /* segue sem url */
  }
  return { id: mediaId, url };
}

async function createContainer(userId: string, text: string, imageUrl?: string): Promise<string> {
  const form: Record<string, string> = imageUrl
    ? { media_type: "IMAGE", image_url: imageUrl, text }
    : { media_type: "TEXT", text };
  const j = await api(`/${userId}/threads`, form);
  return String(j.id);
}

async function waitContainer(creationId: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const j = await api(`/${creationId}?fields=status,error_message`);
    const st = j.status as string;
    if (st === "FINISHED" || st === "PUBLISHED") return;
    if (st === "ERROR" || st === "EXPIRED") {
      throw new Error(`Container de mídia com status ${st}${j.error_message ? `: ${j.error_message}` : "."}`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Tempo esgotado aguardando o processamento da mídia.");
}

/** Chamada à API do Threads (GET sem body; POST com params no form). */
async function api(pathAndQuery: string, form?: Record<string, string>): Promise<any> {
  const s = secrets.threads();
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${G}${pathAndQuery}${form ? "" : `${sep}access_token=${encodeURIComponent(s.accessToken!)}`}`;

  const res = form
    ? await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...form, access_token: s.accessToken! }).toString(),
      })
    : await fetch(url);

  const j = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || j.error) {
    const msg = j.error?.error_user_msg || j.error?.message || `HTTP ${res.status}`;
    throw new Error(`Threads: ${msg}`);
  }
  return j;
}
