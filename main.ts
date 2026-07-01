// DerivaSocial — app desktop (deno desktop) / servidor local (Deno.serve)
import { getPosts, getStats, refreshPosts } from "./store.ts";
import { PAGE } from "./ui.ts";

async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  try {
    if (pathname === "/api/posts") return Response.json(await getPosts());
    if (pathname === "/api/stats") return Response.json(await getStats());
    if (pathname === "/api/refresh" && req.method === "POST") {
      return Response.json({ novos: await refreshPosts() });
    }
    return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch (e) {
    console.error(e);
    return new Response("Erro: " + (e as Error).message, { status: 500 });
  }
}

// Sincroniza ao iniciar
await refreshPosts().catch((e) => console.error("refresh inicial:", e));

// Agenda de hora em hora (no build desktop também roda)
try {
  Deno.cron("poll-rss", "0 * * * *", async () => {
    await refreshPosts().catch((e) => console.error(e));
  });
} catch {
  // Deno.cron pode não estar disponível em todos os contextos
}

// Sem porta fixa: standalone usa 8000; no modo desktop, Deno.serve liga na porta da janela.
Deno.serve({
  onListen: ({ port }) => console.log(`▶ DerivaSocial ativo (porta ${port})`),
}, handler);
