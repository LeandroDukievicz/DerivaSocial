# Blog Syndicator 📣

Detecta **posts novos no RSS do blog**, gera automaticamente uma **copy adaptada para cada rede social** com IA (Claude) e **publica** — com uma etapa de **aprovação no Telegram** (você recebe a prévia e libera com um botão).

> Padrão **POSSE** (*Publish on your Own Site, Syndicate Elsewhere*): o blog é a fonte da verdade; as redes são réplicas automáticas.

---

## Como funciona

```
RSS (/rss.xml)  →  detecta guid novo  →  Claude gera 1 texto por rede
                                              │
                     Telegram: prévia + [✅ Publicar] [❌ Descartar]
                                              │  (edição: mande "rede: novo texto")
                                              ▼
        Mastodon · Bluesky · Telegram   (Fase 1)
        LinkedIn · Instagram · Threads · Facebook   (Fase 2)
                                              │
                           estado salvo em data/state.json (anti-duplicação)
```

- **Sem portas expostas.** Tudo é tráfego de saída (lê o RSS, chama as APIs, e usa *long-polling* do Telegram pra receber os cliques). Não precisa mexer em firewall/Caddy.
- **Não republica o acervo.** Na primeira execução, todos os posts existentes são marcados como "baseline"; só posts **novos** dali pra frente são divulgados.
- **Idempotente.** Cada post é identificado pelo `guid` do RSS; nunca posta duas vezes.

---

## ✅ Credenciais necessárias (Fase 1)

Preencha o `.env` (copie de `.env.example`). Junte estes itens:

| Item | Onde pegar |
|---|---|
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> → API Keys. **É separado** da assinatura do Claude Code. |
| `TELEGRAM_BOT_TOKEN` | Fale com **@BotFather** → `/newbot` → copie o token. Depois dê `/start` no seu bot. |
| `TELEGRAM_ADMIN_CHAT_ID` | Fale com **@userinfobot** → ele te dá seu `id` numérico. |
| `TELEGRAM_CHANNEL_ID` | O @ do seu canal (ex.: `@devsaderiva`). **Adicione o bot como administrador do canal.** |
| `MASTODON_INSTANCE` + `MASTODON_TOKEN` | Na sua instância: Preferências → Desenvolvimento → Nova aplicação → escopo `write:statuses` → copie o *token de acesso*. |
| `BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD` | Bluesky → Configurações → **App Passwords** → criar (nunca use a senha principal). O identifier é o handle, ex.: `devsaderiva.bsky.social`. |

> Se ainda não tem conta no Mastodon/Bluesky, crie antes. Comece só com as que já tiver — ajuste `ENABLED_NETWORKS` no `.env`.

---

## Rodar localmente (teste)

```bash
cp .env.example .env      # e preencha
npm install
npm start
```

Na primeira vez ele marca o baseline e te manda uma mensagem no Telegram. Para testar o fluxo completo, publique um post novo no blog (ou espere o próximo) — em até `POLL_INTERVAL_MINUTES` você recebe a prévia para aprovar.

---

## Rodar no VPS (produção, com Docker)

```bash
# no servidor, dentro da pasta do projeto:
cp .env.example .env      # e preencha
docker compose up -d --build
docker compose logs -f    # acompanhar
```

O container fica em `restart: unless-stopped` e o estado persiste em `./data`.

---

## Fluxo de aprovação (Telegram)

Quando sai um post novo, você recebe uma mensagem com a prévia de cada rede e dois botões:

- **✅ Publicar** → posta em todas as redes habilitadas e te devolve o resultado (com links).
- **❌ Descartar** → ignora este post.
- **Editar** → responda no chat com `rede: novo texto` (ex.: `bluesky: minha versão melhor aqui`). Ele atualiza aquele draft e reenvia a prévia.

Para publicar **sem aprovação**, defina `APPROVAL_REQUIRED=false` no `.env`.

---

## Roadmap — Fase 2 (redes com burocracia)

Cada uma exige criar um app de desenvolvedor e/ou conta *Business*; a implementação entra em `src/publishers.ts` (já há stubs):

- **LinkedIn** — app + OAuth (`w_member_social` ou página de empresa).
- **Facebook / Instagram / Threads** — Meta Graph API, conta Business ligada a uma Página. O Instagram exige **imagem** (já temos: o `enclosure` do RSS traz a capa do post).

---

## Custo

- **IA:** cada post gera ~1 chamada curta ao Claude (centavos). `claude-sonnet-4-6` equilibra custo/qualidade; troque para `claude-haiku-4-5` (mais barato) ou `claude-opus-4-8` (melhor) via `LLM_MODEL`.
- **Redes Fase 1:** grátis.

## Estrutura

```
src/
  config.ts       # env + limites por rede + validação
  state.ts        # persistência em data/state.json (anti-duplicação)
  rss.ts          # busca e parsing do feed
  llm.ts          # gera a copy por rede (Claude)
  publishers.ts   # Mastodon, Bluesky, Telegram (+ stubs Fase 2)
  telegram.ts     # bot de aprovação (envio + long-polling dos botões)
  index.ts        # orquestrador (poll do RSS + loop de aprovação)
```
