// Instagram — publicação de foto no feed via "Instagram API with Instagram Login".
// Fluxo: criar container de mídia -> aguardar processamento -> publicar -> obter permalink.
// Token: gerado no painel Meta (60 dias) e renovado automaticamente (ig_refresh_token).
import * as secrets from "./secrets";
import type { Post } from "./store";

const G = "https://graph.instagram.com/v23.0";
const CAPTION_MAX = 2200; // limite do Instagram
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000; // renova 1x/semana

export interface InstagramStatus {
  configured: boolean;
  username?: string;
  expiresAt?: string;
}

export function status(): InstagramStatus {
  const s = secrets.instagram();
  return {
    configured: !!(s.appId && s.appSecret && s.accessToken),
    username: s.username,
    expiresAt: s.expiresAt,
  };
}

/** Renova o token de longa duração se a última renovação tiver mais de 7 dias. */
export async function maybeRefreshToken(): Promise<void> {
  const s = secrets.instagram();
  if (!s.accessToken) return;
  const last = s.refreshedAt ? Date.parse(s.refreshedAt) : 0;
  if (Date.now() - last < REFRESH_EVERY_MS) return;
  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(s.accessToken)}`;
    const res = await fetch(url);
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (res.ok && j.access_token) {
      s.accessToken = j.access_token;
      s.expiresAt = new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString();
      s.refreshedAt = new Date().toISOString();
      await secrets.save();
      console.log(`[instagram] token renovado; expira ${s.expiresAt}`);
    } else {
      // token com <24h de vida ainda não renova — normal; tenta de novo no próximo ciclo
      console.warn(`[instagram] refresh não aplicado: ${j.error?.message ?? res.status}`);
    }
  } catch (e) {
    console.warn("[instagram] refresh falhou:", (e as Error).message);
  }
}

/** Garante que temos o user_id/username da conta (via /me). */
async function ensureUser(): Promise<string> {
  const s = secrets.instagram();
  if (s.userId) return s.userId;
  const j = await api(`/me?fields=user_id,username`);
  s.userId = String(j.user_id ?? j.id);
  s.username = j.username ?? s.username;
  await secrets.save();
  return s.userId!;
}

/** Publica a imagem do post no feed com a legenda. Retorna o permalink. */
export async function publish(post: Post, caption: string): Promise<{ id: string; url?: string }> {
  const s = secrets.instagram();
  if (!s.accessToken) throw new Error("Instagram não configurado (token ausente no keys.txt).");
  if (!post.image) throw new Error("O Instagram exige imagem, e este post não tem imagem no RSS.");

  const userId = await ensureUser();
  const text = caption.slice(0, CAPTION_MAX);

  // 1) container de mídia — tenta a URL original; se falhar (ex.: webp), converte p/ JPEG via proxy
  let creationId: string;
  try {
    creationId = await createContainer(userId, post.image, text);
  } catch (first) {
    if (/\.jpe?g(\?|$)/i.test(post.image)) throw first;
    const jpegUrl = `https://images.weserv.nl/?url=${encodeURIComponent(post.image)}&output=jpg&q=88`;
    try {
      creationId = await createContainer(userId, jpegUrl, text);
    } catch (second) {
      throw new Error(
        `Falha ao criar mídia. Original: ${(first as Error).message} · Convertida(jpg): ${(second as Error).message}`,
      );
    }
  }

  // 2) aguarda o container ficar pronto (imagens costumam ser instantâneas)
  await waitContainer(creationId);

  // 3) publica
  const pub = await api(`/${userId}/media_publish`, { creation_id: creationId });
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

async function createContainer(userId: string, imageUrl: string, caption: string): Promise<string> {
  const j = await api(`/${userId}/media`, { image_url: imageUrl, caption });
  return String(j.id);
}

async function waitContainer(creationId: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const j = await api(`/${creationId}?fields=status_code`);
    const st = j.status_code as string;
    if (st === "FINISHED" || st === "PUBLISHED") return;
    if (st === "ERROR" || st === "EXPIRED") throw new Error(`Container de mídia com status ${st}.`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Tempo esgotado aguardando o processamento da imagem.");
}

/** Chamada à Graph API do Instagram (GET sem body; POST com params no form). */
async function api(pathAndQuery: string, form?: Record<string, string>): Promise<any> {
  const s = secrets.instagram();
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
    throw new Error(`Instagram: ${msg}`);
  }
  return j;
}
