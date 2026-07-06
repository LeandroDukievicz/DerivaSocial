# DerivaSocial

App **desktop** que acompanha os posts do blog [Devs à Deriva](https://devsaderiva.com.br) e **publica nas redes sociais** direto do dashboard — **LinkedIn**, **Instagram** e **Threads** funcionando. Nas próximas fases: métricas de comentários e referral.

Visual no estilo **dark/neon do dashboard LD Studio**.

---

## Stack

- **[Electron](https://www.electronjs.org/)** + **[electron-builder](https://www.electron.build/)** — app instalável real (`.exe` no Windows, `.AppImage`/`.deb` no Linux), com assinatura e auto-update maduros. É o mesmo motor do VS Code.
- **TypeScript** no _main process_ (backend) → compilado com `tsc` para `dist/`.
- **HTML/CSS/JS puro** no _renderer_ (a UI), sem framework.
- **Sharp** para gerar thumbnails locais reaproveitando a imagem original do post com overlay de texto.
- Parser de RSS próprio (regex), persistência em JSON, `fetch` nativo do Node.

### Por que Electron (e não `deno desktop`)

O projeto começou em `deno desktop`, mas ele é **experimental** (lançado em jun/2026, marcado como pré-estável): gera `.AppImage` quebrado, não produz `.exe`/`.msi` único no Windows e a config muda a cada versão. Para termos **instaladores de verdade** agora, migramos para o Electron, que é maduro e tem o melhor ferramental de empacotamento. O _miolo_ (UI + lógica de RSS) foi reaproveitado quase 100%.

---

## Arquitetura

```
Electron (app .exe / .AppImage)
├── main process  (src/main.ts)      → janela + agendador (poll horário) + IPC
│   ├── src/store.ts                 → ingestão do RSS + persistência (JSON em userData)
│   ├── src/thumbnail.ts             → geração local de thumbnails com Sharp
│   ├── src/secrets.ts               → cofre local (userData/secrets.json) + import do keys.txt
│   ├── src/linkedin.ts              → OAuth (navegador) + publicação no perfil
│   ├── src/instagram.ts             → publicação no feed + renovação automática do token
│   ├── src/threads.ts               → publicação no Threads + renovação automática do token
│   ├── src/upcoming.ts              → radar: posts agendados no blog (SSH + psql no VPS)
│   ├── src/imagefit.ts              → proporção de imagem por rede (mede com sharp + enquadra via proxy)
│   ├── src/socialimg.ts             → hospeda thumbs geradas no VPS (SSH) p/ usar nas publicações
│   └── src/preload.ts               → ponte segura (contextBridge) main ⇄ renderer
└── renderer      (renderer/index.html) → dashboard neon (posts + thumbnails + publicação)
        (renderer/post.html)  → janela de detalhe do post (clique no card abre ampliado)
        chama o backend via  window.api.*  (getPosts, publish, linkedinConnect, …)
```

- **Sem servidor HTTP:** o renderer fala com o backend por **IPC** (`contextIsolation` ligado, sem `nodeIntegration` — seguro). Exceção: durante o OAuth do LinkedIn, um servidor local em `localhost:8000` sobe **apenas** para receber o callback e é fechado em seguida.
- **Poll horário:** o main faz `refreshPosts()` ao abrir e a cada 1h (`setInterval`).
- **Dados:** salvos em `app.getPath("userData")` (`~/.config/DerivaSocial/`): `posts.json` (dedup por `guid` do RSS — nunca duplica), `secrets.json` (tokens) e `thumbnails/`.
- **Thumbnails:** geradas a partir da imagem do post, com sugestões locais de texto curto. Depois de gerar, dá pra clicar em **"✔ Usar esta thumb no post"**: ela sobe pro VPS (pasta `/var/www/social`, servida em `devsaderiva.com.br/social/` — isolada do blog) e passa a ser usada **no lugar da imagem do RSS** nas publicações (IG/Threads via URL; LinkedIn via upload direto como thumbnail do card). O post ganha o marcador 🖼 e um botão de **voltar pra imagem original**. O blog não é alterado em nada. Thumbs com +60 dias são apagadas do servidor automaticamente (as redes copiam a imagem ao publicar — apagar a origem não afeta posts já publicados).

---

## 🔑 Redes sociais (publicação)

### Credenciais — `keys.txt` (NUNCA vai pro Git)

As credenciais ficam em `src/keys.txt` (**gitignored**), organizadas por seção. O app importa esse arquivo no start e guarda tudo em `~/.config/DerivaSocial/secrets.json`:

```
linkedin
client id : ...
primary client secret : ...

instagram
id do app do instagram : ...
chave secreta : ...
token de acesso : IGAA...

threads
app id : ...
chave secreta : ...
token de acesso : THAA...

vps
host : root@IP_DO_SERVIDOR
```

> A seção `vps` liga o **radar de agendados do blog** (abaixo). Sem ela o radar fica desligado — o resto do app funciona normalmente.

> O passo a passo completo para obter cada credencial (apps de desenvolvedor, permissões, testers) está em **[SETUP-REDES.md](SETUP-REDES.md)**.

### LinkedIn ✅

- **Como conecta:** botão **"in Conectar LinkedIn"** no topo do dashboard → abre o navegador → você autoriza → o app captura o callback (`localhost:8000`), troca pelo **token (60 dias)** e descobre seu URN. O botão passa a mostrar seu nome e a validade.
- **Como publica:** compartilhamento de **link** no **perfil pessoal** (escopo `w_member_social`) pelo endpoint novo **`/rest/posts`** — que aceita **thumbnail personalizada** no card do artigo (a thumb escolhida sobe direto pro LinkedIn via `/rest/images`). Sem thumb escolhida, o LinkedIn monta o preview com a imagem do blog, como sempre. Se o endpoint novo falhar, o app **cai automaticamente pro formato antigo** (`/v2/ugcPosts`) e registra o aviso no log — nunca deixa de publicar por causa da migração.
- **Decisão registrada:** publicar como *Página* exigiria o produto "Community Management API" (review manual da LinkedIn) — optamos pelo perfil pessoal (sem burocracia e com alcance melhor).
- **Token expirou?** O botão vira "in ⚠ reconectar" — é só clicar e autorizar de novo.

### Instagram ✅

- **Caminho:** "Instagram API with Instagram Login" (`graph.instagram.com`) na conta profissional **@devs_a_deriva**. O token é gerado no painel da Meta (seção *Gerar tokens de acesso*) e colado no `keys.txt`.
- **Como publica:** cria um **container de mídia** com a **imagem do post** + legenda → aguarda processar → publica → captura o **permalink**.
- **Imagem:** o Instagram **exige imagem** (post sem imagem no RSS não publica lá), só aceita **JPEG** e só aceita **proporção entre 4:5 e 1.91:1**. O app mede a capa antes de subir (`imagefit.ts`): se a proporção estourar o limite, **enquadra automaticamente** num canvas válido (letterbox com o fundo escuro da marca, 1080px, via proxy `images.weserv.nl`), já convertendo `.webp` → JPEG; se estiver ok, tenta a original e converte só o formato se for recusada.
- **Renovação automática do token:** o token de 60 dias é renovado **toda semana** no start do app (`ig_refresh_token`) — não precisa voltar ao painel da Meta.
- **Limitações do próprio Instagram:** o link na legenda **não é clicável** (vale para todo mundo); legenda limitada a 2.200 caracteres (o app trunca).

### Threads ✅

- **Caminho:** app Meta próprio com o use case **"Acessar a API do Threads"** (`graph.threads.net`), publicando na conta **@devs_a_deriva**. O token é gerado no painel da Meta (gerador de token do caso de uso, exige *Threads Tester* aceito) e colado no `keys.txt`.
- **Como publica:** cria um **container** (`IMAGE` com a capa do post, ou `TEXT` se não houver imagem) → aguarda processar → publica → captura o **permalink**.
- **Imagem é opcional:** passa pelo mesmo `imagefit.ts` do Instagram (limite do Threads é folgado, 10:1 — quase nunca precisa enquadrar); se mesmo assim a imagem falhar, publica **só o texto com o link** — nunca deixa de postar por causa da imagem.
- **Renovação automática do token:** mesma rotina do Instagram, **toda semana** no start do app (`th_refresh_token`).
- **Limite do Threads:** texto de até **500 caracteres** (o app trunca o excedente) — para o Threads vale encurtar o texto no painel pra garantir que o link não seja cortado.

### Fluxo de publicação no dashboard

1. Card do post → botão **Publicar** → abre o painel com o **texto sugerido** (título + resumo + link + hashtags), totalmente editável.
2. **Publicar agora:** escolhe a **rede** no seletor → **🚀 Publicar agora**.
3. **Ou agendar:** escolhe **data/hora** + marca as **redes** (checkboxes) → **⏰ Agendar** — no horário, o app dispara e publica em **todas as redes selecionadas em paralelo**.
4. O resultado aparece com o **link da publicação**; o chip da rede fica verde ✓ e o post vira "publicado".
5. Cada rede é independente — dá pra publicar o mesmo post no LinkedIn, no Instagram **e** no Threads; nunca duplica na mesma rede.

### 🔍 Janela de detalhe do post

Clicar no **corpo do card** (fora dos botões) abre o post numa **janela própria e ampliada** (`renderer/post.html`): imagem grande, título/resumo completos, chips das redes (clicáveis quando publicado — abrem a publicação no navegador), **um botão de publicar por rede**, agendamento, gerador de thumbnail, arquivar e "Abrir no blog". Uma janela por post (clicar de novo só foca a existente); publicou/agendou em qualquer janela, as outras **atualizam sozinhas**.

### 🗂 Postados e arquivados

O painel tem as abas **Ativos / Postados e arquivados** (com contadores):

- **Automático:** assim que um post é **disparado e publicado** numa rede (via "Publicar agora" ou agendamento), ele sai dos Ativos e vai para **Postados e arquivados** — a lista ativa fica só com o que ainda tem trabalho pendente.
- Nessa aba o botão **Publicar** continua disponível: dá pra completar as redes que faltam (o post permanece lá).
- **Manual:** **"Marcar como lido"** arquiva um post sem publicar (status *lido*); **"Restaurar"** devolve um lido pra lista ativa.
- Nada se perde: publicações feitas e agendamentos continuam registrados no post.

### ⏰ Agendamento — como funciona

- O post agendado ganha o status **agendado** (badge lilás + card "Agendados" nas estatísticas) e o painel mostra data/redes/texto com opção de **cancelar**.
- Um scheduler no main process checa **a cada 30s**; no horário, publica nas redes selecionadas **em paralelo** (`Promise.allSettled`) — se uma falhar, as outras seguem, e o resultado por rede fica registrado no painel.
- **O app precisa estar aberto no horário.** Se estiver fechado, há *catch-up*: o agendamento vencido dispara **assim que o app abrir**.
- O texto agendado é o mesmo para todas as redes (respeitando os limites de cada uma).

### 📅 Radar de agendados do blog

O app mostra também os posts que estão **agendados no dashboard do blog** (ainda sem publicar), pra você deixar o disparo social pré-agendado:

- **Fonte:** o Postgres do dashboard, consultado por **SSH** (host na seção `vps` do `keys.txt`) + `docker exec psql`. Consulta no start, a cada hora e no botão "Atualizar agora".
- **No painel:** o post aparece com badge **"chegando"**, a data/hora em que entra no ar (`📅 no blog: …`) e o card **"Chegando ao blog"** nas estatísticas.
- **Regras:** "Publicar agora" fica bloqueado (o post não existe no ar ainda); o agendamento **exige horário depois** do horário do blog (validado na UI e no backend) e já vem pré-preenchido com **+30 min**.
- **Disparo seguro:** no horário do disparo, o app confere o RSS — se o post do blog **atrasou**, o disparo é **segurado** e re-tentado a cada 30s até o post entrar no ar. Quando publica, o registro do radar vira o post normal (mesmo guid do RSS, sem duplicar).
- Se o post for **desagendado/cancelado** no dashboard, ele sai do radar (a menos que já tenha agendamento social — aí fica e o disparo continua segurado).

---

## Rodar em desenvolvimento

```bash
npm install
npm start        # compila (tsc) e abre o app Electron
```

---

## Gerar instaladores / Rebuild

```bash
npm run reinstall    # ⭐ rebuild completo: compila → gera o .deb → instala (pede sudo)
```

Ou por partes:

```bash
npm run dist:linux   # → release/DerivaSocial-*.AppImage  e  *.deb
npm run dist:win     # → release/DerivaSocial Setup *.exe (instalador NSIS)
npm run dist         # ambos (linux + windows)
npm run install:deb  # instala o .deb já gerado (sem o aviso do apt)
```

### Rodar no Linux (recomendado: `.deb`)

O `.deb` instala no menu, configura o sandbox do Chromium e abre no duplo-clique — sem flags.

> **Por que `install:deb` copia pra `/tmp` antes:** o apt usa um usuário interno (`_apt`) que **não consegue ler arquivos dentro da sua home**, o que gera o aviso `N: ...sem isolamento... Permissão negada`. É inofensivo (instala mesmo assim), mas instalando a partir de `/tmp` (legível por todos) o aviso não aparece.

**Alternativa `.AppImage`:** precisa da lib FUSE2 uma única vez —
```bash
sudo apt install libfuse2      # depois é só dar duplo-clique no .AppImage
# ou, sem instalar nada:
./release/DerivaSocial-*.AppImage --appimage-extract-and-run
```

> **Cross-compile:** o `.exe` (Windows) pode ser gerado a partir do Linux (`npm run dist:win`); alguns alvos baixam ferramentas do `electron-builder` na primeira execução.
>
> **Dev (`npm start`)** usa `--no-sandbox` porque o binário do Electron em `node_modules` não tem o sandbox SUID configurado (o `.deb` instalado tem, então lá não precisa).

---

## Milestones

| | Entrega | Status |
|---|---|---|
| **M0** | Dashboard lista posts do blog (novo/publicado) + sincronização horária | ✅ |
| **M1** | Publicar nas redes | **✅ completo — LinkedIn · Instagram · Threads** |
| **M2** | Métricas: comentários | — |
| **M3** | Referral: visitas vindas das redes | precisa de analytics no blog |

---

## Estrutura

```
src/
  main.ts        # Electron main: janela, IPC, agendador (poll horário)
  preload.ts     # contextBridge (window.api)
  store.ts       # RSS (parser próprio) + persistência JSON
  thumbnail.ts   # composição de thumbnail com imagem original + texto
  secrets.ts     # cofre local de credenciais + parser do keys.txt
  linkedin.ts    # OAuth + publicação no perfil (ugcPosts)
  instagram.ts   # publicação no feed (container→publish) + refresh do token
  threads.ts     # publicação no Threads (container→publish) + refresh do token
  upcoming.ts    # radar de posts agendados no blog (SSH + psql, host no keys.txt)
  keys.txt       # credenciais (GITIGNORED — nunca versionar!)
renderer/
  index.html     # dashboard (tema neon LD Studio) — usa window.api
assets/          # ícone do app (derivado do logo oficial do blog): capacete-de-astronauta.* PNG/ICO
dist/            # saída do tsc (gitignored)
release/         # instaladores gerados pelo electron-builder (gitignored)
SETUP-REDES.md   # passo a passo para obter as credenciais das redes
```

## Config (env, opcional)

- `RSS_URL` — padrão `https://devsaderiva.com.br/rss.xml`

## Segurança

- `keys.txt`, `.env` e afins estão no `.gitignore` — **segredos nunca vão pro repositório**.
- Tokens ficam só em `~/.config/DerivaSocial/secrets.json` (máquina local).
- Renderer isolado (contextIsolation, sem nodeIntegration); toda chamada de rede acontece no main process.
