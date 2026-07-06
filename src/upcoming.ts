// Radar do blog — posts AGENDADOS no dashboard (ainda não publicados, fora do RSS).
// Consulta o Postgres do VPS via SSH + docker exec psql. O host SSH fica no keys.txt
// (seção "vps", gitignored) — nunca no código: o repositório é público.
import { spawn } from "node:child_process";
import * as secrets from "./secrets";

export interface UpcomingBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  image?: string;
  category?: string;
  blogScheduledAt: string; // ISO UTC — quando o post entra no ar no blog
}

const PSQL_CMD =
  "docker exec -i dashboard-ldstudio-postgres-1 psql -U dashboard_ldstudio -d dashboard_ldstudio -tA -f -";

// timestamps do banco são UTC (naive) — o "Z" no to_char explicita isso pro JS
const QUERY = `
SELECT COALESCE(json_agg(t), '[]'::json) FROM (
  SELECT p.slug, p.title, COALESCE(p.excerpt, '') AS excerpt,
         p."thumbUrl" AS image, c.name AS category,
         to_char(p."scheduledAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at
  FROM posts p JOIN categories c ON c.id = p."categoryId"
  WHERE p.status = 'SCHEDULED' AND p."deletedAt" IS NULL
    AND p.slug IS NOT NULL AND p."scheduledAt" IS NOT NULL
  ORDER BY p."scheduledAt"
) t;
`;

export function configured(): boolean {
  return !!secrets.vps().host;
}

/** Busca os posts agendados no blog. Lança erro se o SSH/psql falhar. */
export async function fetchUpcoming(): Promise<UpcomingBlogPost[]> {
  const host = secrets.vps().host;
  if (!host) return [];
  const out = await sshQuery(host, QUERY);
  const rows = JSON.parse(out.trim() || "[]") as Array<{
    slug: string; title: string; excerpt: string; image: string | null; category: string | null; at: string;
  }>;
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt || "",
    image: r.image || undefined,
    category: r.category || undefined,
    blogScheduledAt: r.at,
  }));
}

/** Roda a query no VPS mandando o SQL por stdin (evita escaping de aspas no shell remoto). */
function sshQuery(host: string, sql: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, PSQL_CMD]);
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Tempo esgotado consultando o banco do blog."));
    }, 20_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`ssh/psql código ${code}: ${err.slice(0, 300)}`));
    });
    child.stdin.end(sql);
  });
}
