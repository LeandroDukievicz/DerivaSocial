# DerivaSocial 📣

App **desktop** (feito com [`deno desktop`](https://docs.deno.com/runtime/desktop/)) que acompanha os posts do
blog e — nas próximas fases — publica automaticamente nas redes sociais (Threads, Instagram, LinkedIn), com
dashboard, métricas e referral.

Visual no estilo **dark/neon do LD Studio**.

## Rodar (dev, no navegador)

```bash
deno task start        # abre em http://localhost:8000
# ou: deno task dev    # com --watch
```

## Empacotar como app desktop (.exe / .AppImage / .dmg)

```bash
deno task build:linux  # gera dist/DerivaSocial-linux
deno task build:win    # gera dist/DerivaSocial-win
deno task build:all    # gera Linux + Windows
```

## Milestones

|        | Entrega                                                                                         | Status            |
| ------ | ----------------------------------------------------------------------------------------------- | ----------------- |
| **M0** | App abre + dashboard lista posts do blog (novo/publicado) + sincronização horária (`Deno.cron`) | ✅ atual          |
| **M1** | Publicar nas 3 redes (Threads, Instagram, LinkedIn)                                             | credenciais/apps  |
| **M2** | Métricas: comentários                                                                           | —                 |
| **M3** | Referral: visitas vindas das redes                                                              | analytics do blog |

## Estrutura

```
main.ts    # servidor (Deno.serve) + rotas de API + agendador (Deno.cron)
store.ts   # ingestão do RSS + persistência (JSON em ./data)
ui.ts      # dashboard (HTML/CSS/JS, tema neon LD Studio)
deno.json  # tasks + config do deno desktop
```

## Config (env, opcional)

- `RSS_URL` (padrão `https://devsaderiva.com.br/rss.xml`)
- `PORT` (padrão `8000`, ignorado no modo desktop)
- `DATA_DIR` (padrão `./data`)
