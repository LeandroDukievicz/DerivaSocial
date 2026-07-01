import { AtpAgent, RichText } from '@atproto/api';
import { config } from './config.ts';

export interface PubResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/** Publica um texto numa rede. Retorna resultado (não lança). */
export async function publish(network: string, text: string): Promise<PubResult> {
  try {
    switch (network) {
      case 'mastodon':
        return await mastodon(text);
      case 'bluesky':
        return await bluesky(text);
      case 'telegram':
        return await telegramChannel(text);
      // ---- Fase 2: implementar quando as credenciais/apps existirem ----
      case 'linkedin':
      case 'instagram':
      case 'threads':
      case 'facebook':
        return { ok: false, error: `${network}: publisher da Fase 2 ainda não implementado` };
      default:
        return { ok: false, error: `rede desconhecida: ${network}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ---------- Mastodon ----------
async function mastodon(text: string): Promise<PubResult> {
  const { instance, token } = config.mastodon;
  const r = await fetch(`${instance.replace(/\/$/, '')}/api/v1/statuses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: text, visibility: 'public' }),
  });
  if (!r.ok) return { ok: false, error: `Mastodon HTTP ${r.status}: ${await r.text()}` };
  const j: any = await r.json();
  return { ok: true, url: j.url };
}

// ---------- Bluesky (AT Protocol) ----------
let bsky: AtpAgent | null = null;
async function bluesky(text: string): Promise<PubResult> {
  if (!bsky) {
    bsky = new AtpAgent({ service: 'https://bsky.social' });
    await bsky.login({ identifier: config.bluesky.identifier, password: config.bluesky.appPassword });
  }
  // RichText detecta links/menções e gera os "facets" (senão o link não fica clicável)
  const rt = new RichText({ text });
  await rt.detectFacets(bsky);
  const res = await bsky.post({ text: rt.text, facets: rt.facets, createdAt: new Date().toISOString() });
  const rkey = res.uri.split('/').pop();
  const handle = config.bluesky.identifier;
  return { ok: true, url: `https://bsky.app/profile/${handle}/post/${rkey}` };
}

// ---------- Telegram (canal) ----------
async function telegramChannel(text: string): Promise<PubResult> {
  const { botToken, channelId } = config.telegram;
  if (!channelId) return { ok: false, error: 'TELEGRAM_CHANNEL_ID não configurado' };
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: channelId, text }),
  });
  const j: any = await r.json();
  if (!j.ok) return { ok: false, error: `Telegram ${j.error_code}: ${j.description}` };
  return { ok: true };
}
