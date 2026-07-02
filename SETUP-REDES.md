# 🔑 Setup das redes (M1) — passo a passo da SUA parte

Ordem escolhida: **LinkedIn primeiro**, depois **Instagram** e **Threads**.
São **3 cadastros** (o Threads exige um app Meta separado — é um "use case" próprio).
Guarde cada valor num bloco de notas; nada disso vai pro Git. Passos com 🤝 fazemos juntos (tokens/OAuth).

---

## 1️⃣ LINKEDIN

**Pré-requisito:** uma Company Page (se não tiver: <https://www.linkedin.com/company/setup/new> — 2 min, grátis).

1. <https://www.linkedin.com/developers/apps> → **Create app**.
2. Preencher: App name `DerivaSocial` · **LinkedIn Page** (a página acima) · logo (`assets/derivasocialicone-512.png`) · aceitar termos → **Create app**.
3. Aba **Settings** → **Verify** → abrir a URL gerada → **Verify** (você é admin da página).
4. Aba **Products** → **Request access** em:
   - **Share on LinkedIn** (publicar no perfil — `w_member_social`)
   - **Sign In with LinkedIn using OpenID Connect** (pegar seu URN)
   > Ambos liberam na hora. (Postar como Página = "Community Management API", passa por review — deixamos pra depois se quiser.)
5. Aba **Auth** → copiar **Client ID** e **Client Secret** → em **Authorized redirect URLs**, adicionar `http://localhost:8000/callback`.

**📌 Entregar: Client ID + Client Secret.**
🤝 Depois: OAuth juntos → access token + URN.

---

## 2️⃣ META — INSTAGRAM (app 1)

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

## 3️⃣ META — THREADS (app 2, separado)

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
| 1 | LinkedIn (`DerivaSocial`) | Client ID + Client Secret |
| 2 | Meta/Instagram (`derivasocial-instagram`) | App ID + App Secret + @ do IG |
| 3 | Meta/Threads (`derivasocial-threads`) | App ID + App Secret + tester aceito |

- Pode entregar **por partes** — cada rede que chegar, eu já implemento o publisher dela.
- As telas da Meta mudam de texto com frequência: se algo não bater, me mande um print.
- Não tente os passos 🤝 sozinho — fazemos juntos em minutos.
