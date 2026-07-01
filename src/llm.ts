import Anthropic from '@anthropic-ai/sdk';
import { config, LIMITS } from './config.ts';
import type { Post } from './rss.ts';

const client = new Anthropic({ apiKey: config.llm.apiKey });

/** Gera um texto por rede habilitada, adaptado ao estilo e ao limite de cada uma. */
export async function generateDrafts(post: Post): Promise<Record<string, string>> {
  const networks = config.enabledNetworks;
  const limitsText = networks.map((n) => `- ${n}: no máximo ~${LIMITS[n] ?? 500} caracteres`).join('\n');

  const system =
    `Você é o social media do blog "${config.siteName}" — tech, carreira e cultura para desenvolvedores, ` +
    `com tom leve, brasileiro, pessoal e direto (nada de "marketês", nem excesso de emoji). ` +
    `Sua tarefa é escrever posts curtos para divulgar um artigo novo do blog.\n` +
    `Regras:\n` +
    `- Português do Brasil, em primeira pessoa (como o autor).\n` +
    `- Um texto por rede, adaptado ao estilo de cada uma e respeitando o limite de caracteres.\n` +
    `- SEMPRE inclua o link do post.\n` +
    `- No máximo 2 a 4 hashtags relevantes (menos ainda no Bluesky/Threads).\n` +
    `- Desperte curiosidade real sobre o conteúdo; sem clickbait vazio.\n` +
    `- Responda APENAS com um objeto JSON válido, sem nenhum texto fora dele.`;

  const user =
    `Novo post no blog:\n` +
    `Título: ${post.title}\n` +
    `Resumo: ${post.summary}\n` +
    `Link: ${post.link}\n` +
    `Categorias: ${post.categories.join(', ') || '—'}\n\n` +
    `Gere um JSON com uma chave por rede, respeitando:\n${limitsText}\n\n` +
    `Formato exato (só o JSON): {${networks.map((n) => `"${n}": "texto"`).join(', ')}}`;

  const msg = await client.messages.create({
    model: config.llm.model,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = (msg.content as any[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const json = extractJson(text);

  const out: Record<string, string> = {};
  for (const n of networks) {
    const fallback = `${post.title}\n\n${post.link}`;
    out[n] = String(json[n] || fallback).slice(0, LIMITS[n] ?? 500);
  }
  return out;
}

function extractJson(s: string): Record<string, string> {
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(s.slice(a, b + 1));
    } catch {
      /* cai no vazio */
    }
  }
  return {};
}
