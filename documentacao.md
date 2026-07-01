# 📄 Documentação — Blog Syndicator (passo a passo)

Guia completo, do zero até rodando na VPS. Se você seguir na ordem, não tem erro.

> **O que é:** um serviço que vigia o RSS do seu blog e, quando sai um post novo, gera uma legenda por rede social com IA (Claude) e publica — te pedindo aprovação no Telegram antes.

---

## Índice

1. [Visão geral do fluxo](#1-visão-geral-do-fluxo)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo a passo das credenciais](#3-passo-a-passo-das-credenciais)
4. [Configurar o arquivo `.env`](#4-configurar-o-arquivo-env)
5. [Testar localmente no seu PC](#5-testar-localmente-no-seu-pc)
6. [Entender o fluxo de aprovação](#6-entender-o-fluxo-de-aprovação)
7. [Colocar na VPS (produção)](#7-colocar-na-vps-produção)
8. [Operação do dia a dia](#8-operação-do-dia-a-dia)
9. [Como funciona por dentro](#9-como-funciona-por-dentro)
10. [Manutenção](#10-manutenção)
11. [Solução de problemas](#11-solução-de-problemas)
12. [Fase 2 — redes com burocracia](#12-fase-2--redes-com-burocracia)

---

## 1. Visão geral do fluxo

```
[1] RSS do blog        [2] IA (Claude)          [3] Telegram            [4] Redes
publiquei um post  →   gera 1 legenda por   →   prévia + botões    →    posta em
(/rss.xml)             rede (adaptada)          ✅ Publicar / ❌         Mastodon,
                                                (ou edita)              Bluesky, Telegram
                                                                              │
                                              estado salvo (não posta 2x)  ◄──┘
```

Três garantias importantes:
- **Não abre portas** — é tudo saída. Não precisa mexer em firewall/Caddy.
- **Não republica o acervo** — na 1ª execução, marca os posts atuais como "já vistos" e só divulga o que sair **depois**.
- **Nunca posta 2x** — cada post é identificado pelo `guid` do RSS.

---

## 2. Pré-requisitos

- **Node.js 20+** (para testar local) — ou só **Docker** (para a VPS).
- **Contas** nas redes da Fase 1: Mastodon, Bluesky e um canal no Telegram.
- **Chave da API do Claude** (paga por uso — centavos/mês; veja o README → Custo).

> ⚠️ **Regra de ouro:** rode **apenas uma instância por vez** (ou local **ou** VPS, nunca as duas). Cada uma tem seu próprio estado; as duas juntas = post duplicado.

---

## 3. Passo a passo das credenciais

Junte tudo isto antes de configurar. Vai para o arquivo `.env`.

### 3.1. Chave da API do Claude (`ANTHROPIC_API_KEY`)
1. Acesse <https://console.anthropic.com>.
2. Faça login (é uma conta **separada** da assinatura do Claude Code).
3. Menu **API Keys** → **Create Key** → copie o valor (`sk-ant-...`).
4. Adicione créditos em **Billing** (uns poucos dólares duram meses neste uso).

### 3.2. Bot do Telegram (`TELEGRAM_BOT_TOKEN`)
1. No Telegram, abra conversa com **@BotFather**.
2. Envie `/newbot` → escolha um nome e um @usuário para o bot.
3. Ele devolve um **token** (`123456:ABC-...`). Copie.
4. **Dê `/start` no seu novo bot** (procure pelo @ dele) — sem isso ele não consegue te mandar mensagem.

### 3.3. Seu chat ID (`TELEGRAM_ADMIN_CHAT_ID`)
1. Abra conversa com **@userinfobot**.
2. Ele responde com seu **Id** numérico (ex.: `123456789`). Copie.
3. É para esse chat que as aprovações serão enviadas.

### 3.4. Canal do Telegram (`TELEGRAM_CHANNEL_ID`)
1. Crie (ou use) um canal público, ex.: `@devsaderiva`.
2. **Adicione seu bot como administrador do canal** (Gerenciar canal → Administradores → adicionar o bot, com permissão de publicar).
3. No `.env`, use o @ do canal (ex.: `@devsaderiva`).

### 3.5. Mastodon (`MASTODON_INSTANCE` + `MASTODON_TOKEN`)
1. `MASTODON_INSTANCE` = a URL da sua instância (ex.: `https://mastodon.social`).
2. Na instância: **Preferências → Desenvolvimento → Nova aplicação**.
3. Dê um nome, marque o escopo **`write:statuses`** (pode deixar os de leitura também), salve.
4. Abra a aplicação criada e copie o **"Seu token de acesso"** → `MASTODON_TOKEN`.

### 3.6. Bluesky (`BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD`)
1. `BLUESKY_IDENTIFIER` = seu handle completo (ex.: `devsaderiva.bsky.social`).
2. No app/site: **Configurações → Privacidade e segurança → App Passwords → Add App Password**.
3. Copie a senha gerada → `BLUESKY_APP_PASSWORD`. **Nunca use sua senha principal.**

> 💡 Você pode começar só com as redes que já tiver. Basta ajustar `ENABLED_NETWORKS` (ex.: `ENABLED_NETWORKS=telegram` só pra testar).

---

## 4. Configurar o arquivo `.env`

Na pasta do projeto:

```bash
cp .env.example .env
```

Abra o `.env` e preencha com o que você juntou no passo 3. Exemplo preenchido (valores fictícios):

```env
RSS_URL=https://devsaderiva.com.br/rss.xml
SITE_NAME=Devs à Deriva
POLL_INTERVAL_MINUTES=10

ENABLED_NETWORKS=mastodon,bluesky,telegram
APPROVAL_REQUIRED=true

ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
LLM_MODEL=claude-sonnet-4-6

TELEGRAM_BOT_TOKEN=123456:ABC-xxxxxxxx
TELEGRAM_ADMIN_CHAT_ID=123456789
TELEGRAM_CHANNEL_ID=@devsaderiva

MASTODON_INSTANCE=https://mastodon.social
MASTODON_TOKEN=xxxxxxxx

BLUESKY_IDENTIFIER=devsaderiva.bsky.social
BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

> 🔒 O `.env` **nunca** vai para o Git (já está no `.gitignore`). Só o `.env.example` (modelo, sem segredos) é versionado.

---

## 5. Testar localmente no seu PC

```bash
cd /home/leandro-dukievicz/Projetos/blog-syndicator
npm install        # (só na 1ª vez; já foi feito)
npm start
```

O que esperar:
- No terminal: `Blog Syndicator iniciado. Redes: ... Aprovação: sim`.
- No Telegram (1ª vez): uma mensagem tipo *"Sincronizador iniciado. N posts existentes marcados como baseline..."*. Isso confirma que o bot fala com você. ✅

Para testar o ciclo completo **sem publicar de verdade um post no blog**, você pode:
- **Opção A (real):** publicar um post de teste no blog e esperar até `POLL_INTERVAL_MINUTES`.
- **Opção B (rápido):** reduzir `POLL_INTERVAL_MINUTES=1` e publicar/despublicar um rascunho.

Para parar: `Ctrl + C`.

---

## 6. Entender o fluxo de aprovação

Quando sai um post novo, você recebe no Telegram uma mensagem com:
- Título + link do post.
- A **prévia da legenda de cada rede** (com a contagem de caracteres).
- Dois botões:

| Botão | O que faz |
|---|---|
| **✅ Publicar** | Posta em todas as redes habilitadas e te devolve o resultado (com os links). |
| **❌ Descartar** | Ignora esse post (não posta em lugar nenhum). |

**Editar antes de publicar:** responda no chat no formato `rede: novo texto`. Exemplos:
```
bluesky: Novo texto que eu prefiro aqui 👇 https://devsaderiva.com.br/posts/...
mastodon: Minha versão ajustada pro Mastodon
```
Ele troca aquela legenda e reenvia a prévia com os botões. Quando gostar, clique **✅ Publicar**.

> Para pular a aprovação e publicar direto: `APPROVAL_REQUIRED=false` no `.env`.

---

## 7. Colocar na VPS (produção)

Assim ele roda 24/7 e pega cada post na hora, sem depender do seu PC.

### 7.1. Enviar o código para a VPS
Como o repositório é privado, use uma destas:
- **Git (recomendado):** na VPS, `git clone` do repo privado (precisa de acesso configurado), **ou**
- **Cópia direta:** do seu PC, copie a pasta (sem `node_modules`):
  ```bash
  rsync -av --exclude node_modules --exclude .git --exclude data \
    "/home/leandro-dukievicz/Projetos/blog-syndicator/" \
    root@IP_DO_SERVIDOR:/opt/blog-syndicator/
  ```

### 7.2. Configurar e subir
```bash
# na VPS, dentro da pasta do projeto:
cp .env.example .env      # e preencha (igual ao passo 4)
docker compose up -d --build
docker compose logs -f    # acompanhar (Ctrl+C só sai do log, o container segue)
```

Pronto. O container fica com `restart: unless-stopped` (sobe sozinho após reboot) e o estado persiste em `./data`.

> ⚠️ Antes de ligar na VPS, **desligue o worker local** (regra de ouro: uma instância por vez).

---

## 8. Operação do dia a dia

Não tem operação — é automático. Seu fluxo passa a ser:
1. Publicar o post no blog, como sempre.
2. Em minutos, chega a prévia no Telegram.
3. Você clica **✅ Publicar** (ou edita antes). Fim.

---

## 9. Como funciona por dentro

- **Detecção:** a cada `POLL_INTERVAL_MINUTES` ele baixa o `/rss.xml` e compara os `guid` com o `data/state.json`.
- **Baseline:** na 1ª execução, todos os posts atuais entram como `skipped_baseline` (não são publicados). Isso evita divulgar o acervo inteiro.
- **Anti-duplicação:** o `guid` de cada post publicado fica salvo; ele nunca reprocessa o mesmo.
- **Geração:** monta um prompt com título/resumo/link/categorias e pede ao Claude um JSON com uma legenda por rede (respeitando limites de caractere).
- **Aprovação:** envia a prévia e fica escutando os cliques via *long-polling* (`getUpdates`) do Telegram.
- **Publicação:** ao aprovar, chama a API de cada rede e registra o resultado.

Arquivo de estado (`data/state.json`) — exemplo simplificado:
```json
{
  "seen": {
    "https://devsaderiva.com.br/posts/os-bugs-da-historia": {
      "status": "published",
      "title": "Os Bugs da História"
    }
  },
  "tgOffset": 123456,
  "initialized": true
}
```

---

## 10. Manutenção

**Ver logs (VPS):**
```bash
docker compose logs -f --tail 100
```

**Atualizar o código (VPS):**
```bash
git pull            # (ou rsync de novo)
docker compose up -d --build
```

**Parar / iniciar:**
```bash
docker compose stop
docker compose start
```

**Resetar o estado** (ex.: quer que ele reconsidere tudo do zero):
```bash
docker compose down
rm -f data/state.json
docker compose up -d --build
```
> Cuidado: apagar o estado faz ele tratar os posts atuais como baseline de novo (não republica o acervo, mas "esquece" o histórico).

**Trocar o modelo de IA:** edite `LLM_MODEL` no `.env` (ex.: `claude-haiku-4-5`) e `docker compose up -d`.

---

## 11. Solução de problemas

| Sintoma | Causa provável / solução |
|---|---|
| Erro `Faltando variável de ambiente...` | Falta preencher algo no `.env`. |
| Bot não te manda mensagem | Você não deu `/start` no bot, ou o `TELEGRAM_ADMIN_CHAT_ID` está errado. |
| `Telegram 400: chat not found` (canal) | O bot não é **admin do canal**, ou o `TELEGRAM_CHANNEL_ID` está errado. |
| `Mastodon HTTP 401/403` | Token inválido ou sem escopo `write:statuses`. |
| Bluesky não loga | Use **App Password** (não a senha principal) e o handle completo em `BLUESKY_IDENTIFIER`. |
| Não detecta post novo | Confirme que o `/rss.xml` já lista o post; lembre que há o intervalo de poll. |
| Postou duplicado | Provavelmente duas instâncias rodando (local + VPS). Deixe só uma. |

Para diagnóstico, os logs mostram cada etapa: `[novo post]`, `[publicar] mastodon: ok`, etc.

---

## 12. Fase 2 — redes com burocracia

Já existem *stubs* em `src/publishers.ts`. Cada uma exige setup de app/desenvolvedor (só você pode fazer):

- **LinkedIn** — criar app no LinkedIn Developers, OAuth com escopo de publicação (`w_member_social` para perfil, ou API de Página para empresa).
- **Facebook / Instagram / Threads** — Meta Graph API: app no Meta for Developers, conta **Business** ligada a uma **Página do Facebook**, tokens de longa duração. O **Instagram exige imagem** — e nós já temos (a capa do post vem no `enclosure` do RSS).

Quando você tiver os apps criados, é só implementar o `publish()` de cada uma e adicionar ao `ENABLED_NETWORKS`.

---

*Dúvidas ou quiser evoluir (Fase 2, migrar estado pra Postgres, agendar horários de postagem)? É só pedir.*
