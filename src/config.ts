import 'dotenv/config';

function opt(name: string, def = ''): string {
  return (process.env[name] ?? def).trim();
}
function req(name: string): string {
  const v = opt(name);
  if (!v) throw new Error(`Faltando variável de ambiente obrigatória: ${name}`);
  return v;
}

// Limites de caracteres por rede (aproximados; usados pra orientar a IA e cortar excessos).
export const LIMITS: Record<string, number> = {
  mastodon: 500,
  bluesky: 300,
  telegram: 1024,
  linkedin: 3000,
  instagram: 2200,
  threads: 500,
  facebook: 2000,
};

export const config = {
  rssUrl: opt('RSS_URL', 'https://devsaderiva.com.br/rss.xml'),
  siteName: opt('SITE_NAME', 'Devs à Deriva'),
  pollIntervalMs: (parseInt(opt('POLL_INTERVAL_MINUTES', '10'), 10) || 10) * 60_000,
  approvalRequired: opt('APPROVAL_REQUIRED', 'true') !== 'false',
  enabledNetworks: opt('ENABLED_NETWORKS', 'mastodon,bluesky,telegram')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  dataDir: opt('DATA_DIR', './data'),

  llm: {
    apiKey: req('ANTHROPIC_API_KEY'),
    model: opt('LLM_MODEL', 'claude-sonnet-4-6'),
  },
  telegram: {
    botToken: req('TELEGRAM_BOT_TOKEN'),
    adminChatId: req('TELEGRAM_ADMIN_CHAT_ID'),
    channelId: opt('TELEGRAM_CHANNEL_ID'),
  },
  mastodon: {
    instance: opt('MASTODON_INSTANCE'),
    token: opt('MASTODON_TOKEN'),
  },
  bluesky: {
    identifier: opt('BLUESKY_IDENTIFIER'),
    appPassword: opt('BLUESKY_APP_PASSWORD'),
  },
};

/** Valida que cada rede habilitada tem as credenciais necessárias. */
export function validate(): void {
  const n = config.enabledNetworks;
  if (n.includes('telegram') && !config.telegram.channelId)
    throw new Error('ENABLED_NETWORKS inclui "telegram" mas TELEGRAM_CHANNEL_ID está vazio.');
  if (n.includes('mastodon') && (!config.mastodon.instance || !config.mastodon.token))
    throw new Error('"mastodon" habilitado mas MASTODON_INSTANCE / MASTODON_TOKEN faltando.');
  if (n.includes('bluesky') && (!config.bluesky.identifier || !config.bluesky.appPassword))
    throw new Error('"bluesky" habilitado mas BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD faltando.');
  const fase2 = n.filter((x) => ['linkedin', 'instagram', 'threads', 'facebook'].includes(x));
  if (fase2.length)
    console.warn(`[aviso] Redes da Fase 2 habilitadas mas ainda não implementadas: ${fase2.join(', ')}`);
}
