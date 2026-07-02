# 🔑 Setup das redes (M1) — passo a passo da SUA parte

Guia para obter os apps/credenciais de **Threads, Instagram e LinkedIn**. Quando terminar (ou por partes), me passe os valores marcados com **📌** e eu implemento a publicação.

> **Ordem recomendada:** faça a **Meta primeiro** — o mesmo app cobre **Threads _e_ Instagram** (2 de 3 redes).
> Guarde cada valor num bloco de notas. Nada disso vai pro Git.
> Onde estiver escrito 🤝 "fazemos juntos", é a parte chata (tokens) — não trave nela; me chame que a gente extrai.

---

## 🅰️ META — cobre Threads + Instagram

### Passo 1 — Instagram como conta profissional
1. App do Instagram → seu **perfil** → menu **☰** → **Configurações e privacidade**.
2. **Tipo de conta e ferramentas** → **Mudar para conta profissional** → **Empresa (Business)** → concluir.

### Passo 2 — Página do Facebook + vínculo
1. Ter (ou criar) uma **Página do Facebook**: <https://www.facebook.com/pages/create>.
2. Abrir o **Meta Business Suite** (<https://business.facebook.com>) → **Configurações** → **Contas** → **Contas do Instagram** → **Conectar** → conectar seu IG à Página.
3. Conferir que o Instagram aparece **vinculado à Página**.

### Passo 3 — Conta no Threads
1. Ter uma conta no **Threads** (criada a partir do seu Instagram) — necessária para a Threads API.

### Passo 4 — Criar o app de desenvolvedor
1. Acessar <https://developers.facebook.com> e logar com a conta que administra a Página.
2. 1ª vez: **Get Started** → registrar como desenvolvedor (verificar telefone/e-mail).
3. Topo direito → **My Apps** → **Create App** → tipo **Business** → nome (ex.: `derivasocial`) + e-mail → **Create**.

### Passo 5 — Adicionar os produtos
1. No painel do app → **Add product**:
   - **Instagram** (o "Instagram API setup with Facebook Login" / Graph API de publicação).
   - **Threads API**.

### Passo 6 — Pegar as credenciais base
1. Menu **App settings → Basic**.
2. Copiar o **App ID** e revelar/copiar o **App Secret**.
3. **📌 Me entregar: App ID + App Secret.**

### Passo 7 — Papéis (pra já poder testar)
1. **App roles → Roles**: confirmar que você é **Admin** (é, por ter criado). Em **modo de Desenvolvimento** o app já publica **na sua própria conta** sem precisar da App Review completa — ótimo pra começar.

### 🤝 Passo 8 — Tokens e IDs (fazemos juntos)
Com o App ID/Secret em mãos, extraímos (eu te passo os comandos exatos):
- **Instagram Business Account ID** (via Graph API Explorer → `/me/accounts` → `instagram_business_account`).
- **Page access token de longa duração** (60 dias; troca do token curto pelo longo).
- **Threads user token** (OAuth do próprio Threads).
- Permissões usadas: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`; e `threads_basic`, `threads_content_publish`.

---

## 🅱️ LINKEDIN

### Passo 1 — Criar o app
1. Acessar <https://www.linkedin.com/developers/apps> → **Create app**.
2. Preencher: **App name**; **LinkedIn Page** (é obrigatório associar a uma **Página de empresa** — se não tiver, criar grátis em <https://www.linkedin.com/company/setup/new>); logo; aceitar termos → **Create app**.
3. Aba **Settings** → **Verify** (confirmar o vínculo com a Página — você mesmo, como admin dela).

### Passo 2 — Decidir onde publicar
- **Perfil pessoal** (mais simples) **ou** **Página de empresa**? → isso define o produto no passo 3.

### Passo 3 — Pedir o produto (aba Products → Request access)
- **Perfil pessoal:** **"Share on LinkedIn"** + **"Sign In with LinkedIn using OpenID Connect"**.
- **Página de empresa:** **"Community Management API"** (passa por aprovação da LinkedIn).

### Passo 4 — Pegar as credenciais base
1. Aba **Auth** → copiar **Client ID** e **Client Secret**.
2. Ainda em **Auth** → **Authorized redirect URLs** → adicionar: `http://localhost:8000/callback`.
3. **📌 Me entregar: Client ID + Client Secret** (e me diga: perfil pessoal ou página?).

### 🤝 Passo 5 — Token (fazemos juntos)
Depois do produto liberado, a gente completa o **OAuth** (você autoriza no navegador) e pega o **access token** + seu identificador (**URN**).

---

## ✅ Resumo — o que me entregar no fim

| Rede | Você me passa | Extraímos juntos 🤝 |
|---|---|---|
| **Meta (Threads + Instagram)** | App ID, App Secret | IG Business Account ID, Page token (longo), Threads token |
| **LinkedIn** | Client ID, Client Secret + (perfil ou página?) | access token, URN |

Pode entregar **por partes** — assim que sair a **Meta**, já dá pra eu implementar Threads + Instagram, sem esperar o LinkedIn.

> **Observações**
> - Não é mais necessário nada de IA nem Telegram (a aprovação é no próprio dashboard).
> - As Reviews de app (Meta/LinkedIn) podem levar de horas a dias — por isso começamos em modo dev, publicando nas suas próprias contas.
