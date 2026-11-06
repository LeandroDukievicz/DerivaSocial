# 🔑 Setup das redes (M1) — passo a passo da SUA parte

Configure **Instagram** e **Threads**.
São **2 cadastros** (o Threads exige um app Meta separado — é um "use case" próprio).
Guarde cada valor num bloco de notas; nada disso vai pro Git. Passos com 🤝 fazemos juntos (tokens/OAuth).

---

## 1️⃣ META — INSTAGRAM (app 1)

1. **Instagram profissional:** app IG → perfil → ☰ → Configurações e privacidade → **Tipo de conta e ferramentas** → **Mudar para conta profissional** → **Empresa**.
2. **Página do Facebook:** ter/criar (<https://www.facebook.com/pages/create>) e **vincular o IG à Página**: <https://business.facebook.com> → Configurações → Contas → **Contas do Instagram** → Conectar.
3. **Registro de dev:** <https://developers.facebook.com> → Get Started (verificar telefone/e-mail).
4. **Criar app:** My Apps → **Create App** → use case de **Instagram** (se só houver lista genérica: Other → **Business**) → nome `derivasocial-instagram` → Create.
5. Garantir produto **Instagram** adicionado (Add product → Instagram → Set up).
6. **App settings → Basic** → copiar **App ID** + **App Secret**.

**📌 Entregar: App ID + App Secret + @ da conta IG.**
🤝 Depois: Graph API Explorer juntos → **IG Business Account ID** + token de longa duração.
> Em modo dev o app publica na SUA conta sem App Review.

---

## 2️⃣ META — THREADS (app 2, separado) — ✅ CONCLUÍDO (2026-07-05)

> **Status:** app `derivasocial-threads` criado, tester aceito, token de longa duração gerado no painel
> (Casos de uso → Acessar a API do Threads → gerador de token) e salvo no `keys.txt`.
> Publicação implementada em `src/threads.ts` (container → publish, texto até 500 chars,
> imagem com fallback jpg, renovação automática semanal via `th_refresh_token`).

1. Ter conta no **Threads** (criada do seu IG).
2. <https://developers.facebook.com> → My Apps → **Create App** → use case **"Access the Threads API"** → nome `derivasocial-threads` → Create.
3. Produto **Threads API**: marcar permissões `threads_basic` + `threads_content_publish`. (Redirect Callback URL exige HTTPS — 🤝 configuramos juntos.)
4. **App roles → Roles** → Add people → **Threads Tester** → sua conta. Depois **aceitar o convite no app do Threads** (Configurações → Conta → Site e permissões / Controles de convite).
5. **App settings → Basic** → copiar **App ID** + **App Secret** (se houver par específico do Threads, é esse).

**📌 Entregar: App ID + App Secret + convite de tester aceito.**
🤝 Depois: OAuth do Threads juntos → token de longa duração (60 dias, renovável).

---

## ✅ Resumo dos entregáveis

| # | Cadastro | 📌 Entregar |
|---|---|---|
| 1 | Meta/Instagram (`derivasocial-instagram`) | App ID + App Secret + @ do IG |
| 2 | Meta/Threads (`derivasocial-threads`) | App ID + App Secret + tester aceito |

- Pode entregar **por partes** — cada rede que chegar, eu já implemento o publisher dela.
- As telas da Meta mudam de texto com frequência: se algo não bater, me mande um print.
- Não tente os passos 🤝 sozinho — fazemos juntos em minutos.
