# DerivaSocial

App **desktop** que acompanha os posts do blog [Devs à Deriva](https://devsaderiva.com.br) e **publica nas redes sociais** direto do dashboard — hoje com **LinkedIn** e **Instagram** funcionando e **Threads** a caminho. Nas próximas fases: métricas de comentários e referral.

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
│   └── src/preload.ts               → ponte segura (contextBridge) main ⇄ renderer
└── renderer      (renderer/index.html) → dashboard neon (posts + thumbnails + publicação)
        chama o backend via  window.api.*  (getPosts, publish, linkedinConnect, …)
```

- **Sem servidor HTTP:** o renderer fala com o backend por **IPC** (`contextIsolation` ligado, sem `nodeIntegration` — seguro). Exceção: durante o OAuth do LinkedIn, um servidor local em `localhost:8000` sobe **apenas** para receber o callback e é fechado em seguida.
- **Poll horário:** o main faz `refreshPosts()` ao abrir e a cada 1h (`setInterval`).
- **Dados:** salvos em `app.getPath("userData")` (`~/.config/DerivaSocial/`): `posts.json` (dedup por `guid` do RSS — nunca duplica), `secrets.json` (tokens) e `thumbnails/`.
- **Thumbnails:** geradas a partir da imagem do post, com sugestões locais de texto curto.

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
```

> O passo a passo completo para obter cada credencial (apps de desenvolvedor, permissões, testers) está em **[SETUP-REDES.md](SETUP-REDES.md)**.

### LinkedIn ✅

- **Como conecta:** botão **"in Conectar LinkedIn"** no topo do dashboard → abre o navegador → você autoriza → o app captura o callback (`localhost:8000`), troca pelo **token (60 dias)** e descobre seu URN. O botão passa a mostrar seu nome e a validade.
- **Como publica:** compartilhamento de **link** no **perfil pessoal** (`/v2/ugcPosts`, escopo `w_member_social`) — o LinkedIn monta o preview do artigo com a imagem do blog.
- **Decisão registrada:** publicar como *Página* exigiria o produto "Community Management API" (review manual da LinkedIn) — optamos pelo perfil pessoal (sem burocracia e com alcance melhor).
- **Token expirou?** O botão vira "in ⚠ reconectar" — é só clicar e autorizar de novo.

### Instagram ✅

- **Caminho:** "Instagram API with Instagram Login" (`graph.instagram.com`) na conta profissional **@devs_a_deriva**. O token é gerado no painel da Meta (seção *Gerar tokens de acesso*) e colado no `keys.txt`.
- **Como publica:** cria um **container de mídia** com a **imagem do post** + legenda → aguarda processar → publica → captura o **permalink**.
- **Imagem:** o Instagram **exige imagem** (post sem imagem no RSS não publica lá) e só aceita **JPEG** — como as capas do blog são `.webp`, o app tenta a original e, se recusada, **converte para JPG automaticamente** (proxy `images.weserv.nl`) e tenta de novo.
- **Renovação automática do token:** o token de 60 dias é renovado **toda semana** no start do app (`ig_refresh_token`) — não precisa voltar ao painel da Meta.
- **Limitações do próprio Instagram:** o link na legenda **não é clicável** (vale para todo mundo); legenda limitada a 2.200 caracteres (o app trunca).

### Threads 🔜

Stub pronto no seletor de rede. Falta criar o app Meta com o use case **"Acessar a API do Threads"** (ver SETUP-REDES.md) e implementar o publisher.

### Fluxo de publicação no dashboard

1. Card do post → botão **Publicar** → abre o painel com o **texto sugerido** (título + resumo + link + hashtags), totalmente editável.
2. **Publicar agora:** escolhe a **rede** no seletor → **🚀 Publicar agora**.
3. **Ou agendar:** escolhe **data/hora** + marca as **redes** (checkboxes) → **⏰ Agendar** — no horário, o app dispara e publica em **todas as redes selecionadas em paralelo**.
4. O resultado aparece com o **link da publicação**; o chip da rede fica verde ✓ e o post vira "publicado".
5. Cada rede é independente — dá pra publicar o mesmo post no LinkedIn **e** no Instagram; nunca duplica na mesma rede.

### ⏰ Agendamento — como funciona

- O post agendado ganha o status **agendado** (badge lilás + card "Agendados" nas estatísticas) e o painel mostra data/redes/texto com opção de **cancelar**.
- Um scheduler no main process checa **a cada 30s**; no horário, publica nas redes selecionadas **em paralelo** (`Promise.allSettled`) — se uma falhar, as outras seguem, e o resultado por rede fica registrado no painel.
- **O app precisa estar aberto no horário.** Se estiver fechado, há *catch-up*: o agendamento vencido dispara **assim que o app abrir**.
- O texto agendado é o mesmo para todas as redes (respeitando os limites de cada uma).

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
./release/DerivaSocial-0.1.0.AppImage --appimage-extract-and-run
```

> **Cross-compile:** o `.exe` (Windows) pode ser gerado a partir do Linux (`npm run dist:win`); alguns alvos baixam ferramentas do `electron-builder` na primeira execução.
>
> **Dev (`npm start`)** usa `--no-sandbox` porque o binário do Electron em `node_modules` não tem o sandbox SUID configurado (o `.deb` instalado tem, então lá não precisa).

---

## Milestones

| | Entrega | Status |
|---|---|---|
| **M0** | Dashboard lista posts do blog (novo/publicado) + sincronização horária | ✅ |
| **M1** | Publicar nas redes | **LinkedIn ✅ · Instagram ✅ · Threads 🔜** |
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
  keys.txt       # credenciais (GITIGNORED — nunca versionar!)
renderer/
  index.html     # dashboard (tema neon LD Studio) — usa window.api
assets/          # ícone oficial do app: capacete-de-astronauta.png e derivados PNG/ICO
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
