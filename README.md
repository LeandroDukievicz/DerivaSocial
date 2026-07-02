# DerivaSocial

App **desktop** que acompanha os posts do blog [Devs à Deriva](https://devsaderiva.com.br) e — nas próximas fases — publica automaticamente nas redes sociais (**Threads, Instagram, LinkedIn**), com dashboard, métricas e referral.

Visual no estilo **dark/neon do dashboard LD Studio**.

---

## Stack

- **[Electron](https://www.electronjs.org/)** + **[electron-builder](https://www.electron.build/)** — app instalável real (`.exe` no Windows, `.AppImage`/`.deb` no Linux), com assinatura e auto-update maduros. É o mesmo motor do VS Code.
- **TypeScript** no _main process_ (backend) → compilado com `tsc` para `dist/`.
- **HTML/CSS/JS puro** no _renderer_ (a UI), sem framework.
- **Sem dependências de runtime pesadas**: parser de RSS próprio (regex), persistência em JSON, `fetch` nativo do Node.

### Por que Electron (e não `deno desktop`)

O projeto começou em `deno desktop`, mas ele é **experimental** (lançado em jun/2026, marcado como pré-estável): gera `.AppImage` quebrado, não produz `.exe`/`.msi` único no Windows e a config muda a cada versão. Para termos **instaladores de verdade** agora, migramos para o Electron, que é maduro e tem o melhor ferramental de empacotamento. O _miolo_ (UI + lógica de RSS) foi reaproveitado quase 100%.

---

## Arquitetura

```
Electron (app .exe / .AppImage)
├── main process  (src/main.ts)      → janela + agendador (poll horário) + IPC
│   ├── src/store.ts                 → ingestão do RSS + persistência (JSON em userData)
│   └── src/preload.ts               → ponte segura (contextBridge) main ⇄ renderer
└── renderer      (renderer/index.html) → dashboard neon (lista novo/publicado)
        chama o backend via  window.api.getPosts() / getStats() / refresh()
```

- **Sem servidor HTTP:** o renderer fala com o backend por **IPC** (`contextIsolation` ligado, sem `nodeIntegration` — seguro).
- **Poll horário:** o main faz `refreshPosts()` ao abrir e a cada 1h (`setInterval`).
- **Dados:** salvos em `app.getPath("userData")/posts.json` (dedup por `guid` do RSS — nunca duplica).

---

## Rodar em desenvolvimento

```bash
npm install
npm start        # compila (tsc) e abre o app Electron
```

---

## Gerar instaladores

```bash
npm run dist:linux   # → release/DerivaSocial-*.AppImage  e  *.deb
npm run dist:win     # → release/DerivaSocial Setup *.exe (instalador NSIS)
npm run dist         # ambos (linux + windows)
```

### Rodar no Linux (recomendado: `.deb`)

```bash
npm run reinstall     # empacota o .deb e instala (pede sudo)
```
Ou em dois passos:
```bash
npm run dist:linux    # gera o .deb / .AppImage em release/
npm run install:deb   # instala sem o aviso do apt (ver nota abaixo)
```
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

| | Entrega | Precisa de |
|---|---|---|
| **M0** | App abre + dashboard lista posts do blog (novo/publicado) + sincronização horária | atual |
| **M1** | Publicar nas 3 redes (Threads, Instagram, LinkedIn) | apps/tokens das redes |
| **M2** | Métricas: comentários | — |
| **M3** | Referral: visitas vindas das redes | analytics do blog |

---

## Estrutura

```
src/
  main.ts        # Electron main: janela, IPC, agendador (poll horário)
  preload.ts     # contextBridge (window.api)
  store.ts       # RSS (parser próprio) + persistência JSON
renderer/
  index.html     # dashboard (tema neon LD Studio) — usa window.api
assets/          # ícone oficial do app: derivasocialicone.png e derivados PNG/ICO
dist/            # saída do tsc (gitignored)
release/         # instaladores gerados pelo electron-builder (gitignored)
```

## Config (env, opcional)

- `RSS_URL` — padrão `https://devsaderiva.com.br/rss.xml`
