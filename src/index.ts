import { config, validate } from './config.ts';
import * as store from './state.ts';
import { fetchPosts, newPosts, type Post } from './rss.ts';
import { generateDrafts } from './llm.ts';
import { publish } from './publishers.ts';
import * as tg from './telegram.ts';

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function baseRec(p: Post, status: store.Record['status']): store.Record {
  return { guid: p.guid, title: p.title, link: p.link, status, createdAt: new Date().toISOString() };
}

/** Publica um registro em todas as redes habilitadas e reporta no Telegram. */
async function doPublish(rec: store.Record): Promise<void> {
  const drafts = rec.drafts || {};
  const results: Record<string, unknown> = {};
  for (const n of config.enabledNetworks) {
    const r = await publish(n, drafts[n] || `${rec.title}\n\n${rec.link}`);
    results[n] = r;
    console.log(`[publicar] ${n}: ${r.ok ? 'ok' : 'ERRO ' + r.error}`);
  }
  rec.results = results;
  rec.status = 'published';
  await store.save();
  const summary = Object.entries(results)
    .map(([n, r]: [string, any]) => (r.ok ? `✅ ${n}${r.url ? ` — ${r.url}` : ''}` : `❌ ${n}: ${r.error}`))
    .join('\n');
  await tg.notify(`📣 "${rec.title}" publicado:\n${summary}`);
}

/** Checa o RSS, gera drafts para posts novos e envia para aprovação (ou publica). */
async function processNewPosts(): Promise<void> {
  const st = store.get();
  const posts = await fetchPosts();

  // Primeira execução: marca tudo que já existe como baseline (não republica o acervo).
  if (!st.initialized) {
    for (const p of posts) st.seen[p.guid] = baseRec(p, 'skipped_baseline');
    st.initialized = true;
    await store.save();
    console.log(`[baseline] ${posts.length} posts existentes marcados. Só posts novos serão divulgados a partir de agora.`);
    await tg.notify(
      `🔧 Sincronizador iniciado. ${posts.length} posts existentes marcados como baseline. ` +
      `A partir de agora, todo post NOVO no blog vira sugestão de divulgação aqui.`,
    );
    return;
  }

  for (const p of newPosts(posts)) {
    console.log(`[novo post] ${p.title}`);
    const rec = baseRec(p, 'generating');
    st.seen[p.guid] = rec;
    await store.save();
    try {
      rec.drafts = await generateDrafts(p);
      rec.shortId = shortId();
      st.pendingByShort[rec.shortId] = p.guid;
      rec.status = config.approvalRequired ? 'pending' : 'approved';
      await store.save();
      if (config.approvalRequired) await tg.sendApproval(rec);
      else await doPublish(rec);
    } catch (e: any) {
      rec.status = 'error';
      rec.results = { error: e?.message || String(e) };
      await store.save();
      await tg.notify(`❌ Erro gerando divulgação de "${p.title}": ${e?.message || e}`);
    }
  }
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error('erro no ciclo de RSS', e);
  }
}

async function main(): Promise<void> {
  validate();
  await store.load();
  console.log(
    `Blog Syndicator iniciado. Redes: ${config.enabledNetworks.join(', ')} · ` +
    `Aprovação: ${config.approvalRequired ? 'sim' : 'não'} · Poll: ${config.pollIntervalMs / 60000}min`,
  );

  // Loop de aprovação (Telegram) — roda em paralelo, não bloqueia o poll do RSS.
  tg.pollLoop({
    onPublish: async (sid) => {
      const guid = store.get().pendingByShort[sid];
      if (!guid) return;
      const rec = store.get().seen[guid];
      if (rec && rec.status === 'pending') {
        await doPublish(rec);
        delete store.get().pendingByShort[sid];
        await store.save();
      }
    },
    onDiscard: async (sid) => {
      const guid = store.get().pendingByShort[sid];
      if (!guid) return;
      const rec = store.get().seen[guid];
      if (rec) {
        rec.status = 'discarded';
        delete store.get().pendingByShort[sid];
        await store.save();
      }
    },
    onEdit: async (network, text) => {
      // Edita o draft do post pendente mais recente e reenvia a prévia.
      const pend = Object.values(store.get().seen)
        .filter((r) => r.status === 'pending')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const rec = pend[0];
      if (rec?.drafts) {
        rec.drafts[network] = text;
        await store.save();
        await tg.notify(`✏️ Draft de ${network} atualizado para "${rec.title}".`);
        await tg.sendApproval(rec);
      } else {
        await tg.notify('Nenhum post pendente para editar agora.');
      }
    },
  }).catch((e) => console.error('pollLoop encerrou', e));

  // Primeira checagem + agendamento periódico do RSS.
  await safe(processNewPosts);
  setInterval(() => safe(processNewPosts), config.pollIntervalMs);
}

main().catch((e) => {
  console.error('Falha fatal:', e);
  process.exit(1);
});
