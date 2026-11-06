// Busca apenas o artigo público do blog para preparar a cópia manual no Énóis.
import type { Post } from "./store";

export async function fetchPostHtml(post: Post): Promise<{ html: string; url: string }> {
  if (post.upcoming) throw new Error("O post ainda não foi publicado no blog.");
  let parsed: URL;
  try { parsed = new URL(post.url); } catch { throw new Error("Endereço do post inválido."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "devsaderiva.com.br" || parsed.port ||
      parsed.username || parsed.password || !/^\/posts\/[^/]+\/?$/.test(parsed.pathname)) {
    throw new Error("O endereço não é de um post do Devs à Deriva.");
  }
  const url = `https://devsaderiva.com.br${parsed.pathname}`;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Não foi possível carregar o post (HTTP ${response.status}).`);
  if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("O blog não retornou uma página HTML.");
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("A página do blog é grande demais.");
  return { html, url };
}
