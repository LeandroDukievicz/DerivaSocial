// LinkedIn — OAuth (Authorization Code) + publicação no perfil (ugcPosts).
// Produtos exigidos no app LinkedIn: "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect".
import { shell } from "electron";
import * as http from "node:http";
import { randomBytes } from "node:crypto";
import * as secrets from "./secrets";
import type { Post } from "./store";

const REDIRECT_URI = "http://localhost:8000/callback"; // cadastrado no app LinkedIn (aba Auth)
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

export interface LinkedInStatus {
  configured: boolean;
  connected: boolean;
  expired: boolean;
  name?: string;
  expiresAt?: string;
}

export function status(): LinkedInStatus {
  const s = secrets.linkedin();
  const expired = !!s.expiresAt && Date.now() > Date.parse(s.expiresAt);
  return {
    configured: !!(s.clientId && s.clientSecret),
    connected: !!(s.accessToken && s.personUrn) && !expired,
    expired,
    name: s.name,
    expiresAt: s.expiresAt,
  };
}

/** Abre o navegador para autorizar e captura o callback em localhost:8000. */
export async function connect(): Promise<LinkedInStatus> {
  const s = secrets.linkedin();
  if (!s.clientId || !s.clientSecret) {
    throw new Error("Client ID/Secret do LinkedIn não configurados (keys.txt).");
  }

  const state = randomBytes(16).toString("hex");
  const code = await waitForCode(state, s.clientId);
  const token = await exchangeCode(code, s.clientId, s.clientSecret);
  const me = await userinfo(token.access_token);

  s.accessToken = token.access_token;
  s.expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  s.personUrn = `urn:li:person:${me.sub}`;
  s.name = me.name || me.given_name || "";
  await secrets.save();
  return status();
}

function waitForCode(state: string, clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost:8000");
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end();
        return;
      }
      const err = url.searchParams.get("error_description") || url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const ok = !!code && url.searchParams.get("state") === state && !err;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(pageHtml(ok, err));
      finish(() => (ok ? resolve(code!) : reject(new Error(err || "Autorização negada ou state inválido."))));
    });

    const timer = setTimeout(
      () => finish(() => reject(new Error("Tempo esgotado aguardando a autorização (5 min)."))),
      AUTH_TIMEOUT_MS,
    );

    function finish(cb: () => void) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // pequeno delay pra resposta HTTP chegar antes de fechar
      setTimeout(() => server.close(), 300);
      cb();
    }

    server.on("error", (e: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          new Error(
            e.code === "EADDRINUSE"
              ? "Porta 8000 já está em uso — feche o que estiver usando e tente de novo."
              : `Erro no servidor local: ${e.message}`,
          ),
        )
      );
    });

    server.listen(8000, "127.0.0.1", () => {
      const auth = new URL("https://www.linkedin.com/oauth/v2/authorization");
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", REDIRECT_URI);
      auth.searchParams.set("state", state);
      auth.searchParams.set("scope", "openid profile w_member_social");
      shell.openExternal(auth.toString());
    });
  });
}

function pageHtml(ok: boolean, err?: string | null): string {
  const msg = ok
    ? "<h2>✅ LinkedIn conectado!</h2><p>Pode fechar esta aba e voltar ao DerivaSocial.</p>"
    : `<h2>❌ Falha na autorização</h2><p>${err || "código ausente ou state inválido"}</p>`;
  return `<!doctype html><html><body style="font-family:sans-serif;background:#010212;color:#e6f6ff;display:grid;place-items:center;height:100vh;text-align:center">${msg}</body></html>`;
}

async function exchangeCode(code: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Troca de token falhou (HTTP ${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function userinfo(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo falhou (HTTP ${res.status}): ${await res.text()}`);
  return (await res.json()) as { sub: string; name?: string; given_name?: string };
}

/** Publica no perfil como compartilhamento de link (o LinkedIn monta o preview do artigo). */
export async function publish(post: Post, text: string): Promise<{ id: string; url?: string }> {
  const st = status();
  const s = secrets.linkedin();
  if (!st.connected) {
    throw new Error(st.expired ? "Token do LinkedIn expirou — clique em Conectar de novo." : "LinkedIn não conectado.");
  }

  const body = {
    author: s.personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "ARTICLE",
        media: [{ status: "READY", originalUrl: post.url }],
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${s.accessToken}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Publicação falhou (HTTP ${res.status}): ${await res.text()}`);

  let id = res.headers.get("x-restli-id") || "";
  if (!id) {
    try {
      id = ((await res.json()) as { id?: string }).id || "";
    } catch {
      /* corpo vazio é ok */
    }
  }
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : undefined };
}
