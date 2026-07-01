import { config, LIMITS } from './config.ts';
import * as store from './state.ts';

const API = `https://api.telegram.org/bot${config.telegram.botToken}`;

async function tg(method: string, body: unknown): Promise<any> {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** Mensagem de aprovação (texto puro pra não quebrar com caracteres especiais dos drafts). */
export async function sendApproval(rec: store.Record): Promise<void> {
  const drafts = rec.drafts || {};
  const parts = Object.entries(drafts)
    .map(([n, t]) => `— ${n} (${(t as string).length}/${LIMITS[n] ?? '?'}):\n${t}`)
    .join('\n\n');
  const text =
    `🆕 Novo post pronto para divulgar\n${rec.title}\n${rec.link}\n\n${parts}\n\n` +
    `ID ${rec.shortId} · para editar, mande:  rede: novo texto`;
  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Publicar', callback_data: `p:${rec.shortId}` },
      { text: '❌ Descartar', callback_data: `x:${rec.shortId}` },
    ]],
  };
  await tg('sendMessage', {
    chat_id: config.telegram.adminChatId,
    text,
    reply_markup,
    disable_web_page_preview: true,
  });
}

export async function notify(text: string): Promise<void> {
  await tg('sendMessage', { chat_id: config.telegram.adminChatId, text, disable_web_page_preview: true });
}

async function answer(callbackId: string, text?: string): Promise<void> {
  await tg('answerCallbackQuery', { callback_query_id: callbackId, text });
}

export interface Handlers {
  onPublish: (shortId: string) => Promise<void>;
  onDiscard: (shortId: string) => Promise<void>;
  onEdit: (network: string, text: string) => Promise<void>;
}

/** Loop de long-polling: recebe cliques dos botões e mensagens de edição. */
export async function pollLoop(handlers: Handlers): Promise<void> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (;;) {
    try {
      const st = store.get();
      const res = await tg('getUpdates', {
        offset: st.tgOffset + 1,
        timeout: 30,
        allowed_updates: ['callback_query', 'message'],
      });
      if (res?.ok && Array.isArray(res.result)) {
        for (const u of res.result) {
          st.tgOffset = Math.max(st.tgOffset, u.update_id);
          try {
            await handleUpdate(u, handlers);
          } catch (e) {
            console.error('erro tratando update', e);
          }
        }
        if (res.result.length) await store.save();
      }
    } catch (e) {
      console.error('erro no getUpdates', e);
      await sleep(3000);
    }
  }
}

async function handleUpdate(u: any, h: Handlers): Promise<void> {
  if (u.callback_query) {
    const data: string = u.callback_query.data || '';
    const [action, shortId] = data.split(':');
    if (action === 'p') {
      await answer(u.callback_query.id, 'Publicando…');
      await h.onPublish(shortId);
    } else if (action === 'x') {
      await answer(u.callback_query.id, 'Descartado');
      await h.onDiscard(shortId);
    }
    return;
  }
  if (u.message?.text && String(u.message.chat.id) === String(config.telegram.adminChatId)) {
    const m = u.message.text.match(
      /^(mastodon|bluesky|telegram|linkedin|instagram|threads|facebook):\s*([\s\S]+)$/i,
    );
    if (m) await h.onEdit(m[1].toLowerCase(), m[2].trim());
  }
}
