import { promises as fs } from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Post } from "./store";

export type ThumbnailFormat = "og" | "square" | "story";

export interface ThumbnailRequest {
  text: string;
  format?: ThumbnailFormat;
}

export interface ThumbnailResult {
  path: string;
  dataUrl: string;
  width: number;
  height: number;
}

const FORMATS: Record<ThumbnailFormat, { width: number; height: number; label: string }> = {
  og: { width: 1200, height: 630, label: "og" },
  square: { width: 1080, height: 1080, label: "square" },
  story: { width: 1080, height: 1920, label: "story" },
};

const STOPWORDS = new Set([
  "a", "as", "ao", "aos", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos",
  "o", "os", "ou", "para", "por", "que", "com", "como", "um", "uma", "uns", "umas", "se", "sua",
  "seu", "suas", "seus", "mais", "menos", "sobre", "entre", "sem", "isso", "esse", "essa",
]);

let outputDir = path.join(process.cwd(), "data", "thumbnails");

export function init(dataDir: string): void {
  outputDir = path.join(dataDir, "thumbnails");
}

export function isManagedPath(filePath: string): boolean {
  const normalizedOutput = path.resolve(outputDir) + path.sep;
  const normalizedFile = path.resolve(filePath);
  return normalizedFile.startsWith(normalizedOutput);
}

export function suggestTexts(post: Post): string[] {
  const title = cleanText(post.title);
  const category = cleanText(post.category || "");
  const keyPhrase = extractKeyPhrase(title);
  // 1ª sugestão = título INTEIRO (o layout encolhe a fonte pra caber) — nunca amputado no meio
  const suggestions = [
    trimText(title, 90),
    category ? `${category} na pratica` : `${keyPhrase} na pratica`,
    `O guia direto sobre ${keyPhrase}`,
    `O que muda com ${keyPhrase}`,
    `Evite erros em ${keyPhrase}`,
  ];

  return unique(suggestions)
    .map((s) => trimText(s, 90))
    .filter((s) => s.length >= 6)
    .slice(0, 5);
}

export async function generate(post: Post, req: ThumbnailRequest): Promise<ThumbnailResult> {
  if (!post.image) throw new Error("Este post nao tem imagem no RSS.");

  const format = req.format && FORMATS[req.format] ? req.format : "og";
  const spec = FORMATS[format];
  const text = trimText(cleanText(req.text), 90);
  if (!text) throw new Error("Informe um texto para a thumbnail.");

  const image = await fetchImage(post.image);
  const base = await sharp(image)
    .resize(spec.width, spec.height, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const overlay = Buffer.from(createOverlaySvg({
    width: spec.width,
    height: spec.height,
    title: text,
    category: post.category || "Devs a Deriva",
    format,
  }));

  const buffer = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.mkdir(outputDir, { recursive: true });
  const hash = createHash("sha1").update(`${post.guid}:${text}:${format}`).digest("hex").slice(0, 12);
  const file = path.join(outputDir, `${slug(post.title)}-${format}-${hash}.png`);
  await fs.writeFile(file, buffer);

  return {
    path: file,
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    width: spec.width,
    height: spec.height,
  };
}

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": "derivasocial" } });
  if (!res.ok) throw new Error(`Imagem HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (type && !type.includes("image/")) throw new Error(`URL nao retornou imagem: ${type}`);
  return Buffer.from(await res.arrayBuffer());
}

// Largura média de um caractere em fração do font-size (bold sans do sistema —
// estimativa folgada pra quebra de linha nunca estourar a lateral).
const CHAR_W = 0.62;

/** Encolhe a fonte em degraus até o texto INTEIRO caber nas linhas disponíveis. */
function fitTitle(title: string, availW: number, baseFont: number, minFont: number, maxLines: number): { size: number; lines: string[] } {
  for (let size = baseFont; size >= minFont; size -= 6) {
    const maxChars = Math.max(8, Math.floor(availW / (size * CHAR_W)));
    const wrapped = wrapText(title, maxChars, maxLines);
    if (!wrapped.truncated) return { size, lines: wrapped.lines };
  }
  const maxChars = Math.max(8, Math.floor(availW / (minFont * CHAR_W)));
  return { size: minFont, lines: wrapText(title, maxChars, maxLines).lines };
}

function createOverlaySvg(opts: {
  width: number;
  height: number;
  title: string;
  category: string;
  format: ThumbnailFormat;
}): string {
  const isStory = opts.format === "story";
  const isSquare = opts.format === "square";
  const pad = isStory ? 86 : 70;
  const availW = opts.width - pad * 2;

  // Título: fonte dinâmica — começa grande e encolhe até caber inteiro
  const fit = fitTitle(
    opts.title,
    availW,
    isStory ? 96 : isSquare ? 76 : 74,
    isStory ? 60 : 46,
    isStory || isSquare ? 4 : 3,
  );
  const fontSize = fit.size;
  const lines = fit.lines;
  const lineHeight = Math.round(fontSize * 1.12);
  const textHeight = lines.length * lineHeight;
  const brandY = opts.height - pad;
  const textY = brandY - 68 - textHeight;

  // Caixa da categoria: largura proporcional ao texto (não mais fixa)
  const tag = limitWords(opts.category.toUpperCase(), 3, 28);
  const tagFont = isStory ? 26 : 22;
  const tagPadX = 24;
  const tagH = isStory ? 54 : 46;
  const tagW = Math.min(availW, Math.round(tag.length * (tagFont * 0.68 + 3) + tagPadX * 2));
  const tagY = Math.max(pad, textY - tagH - 26);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#010212" stop-opacity="0.18"/>
      <stop offset="52%" stop-color="#010212" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#010212" stop-opacity="0.94"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#010212" stop-opacity="0"/>
      <stop offset="100%" stop-color="#010212" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00ffff"/>
      <stop offset="100%" stop-color="#ff00cc"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.78"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)"/>
  <rect y="${Math.round(opts.height * 0.36)}" width="100%" height="${Math.round(opts.height * 0.64)}" fill="url(#bottom)"/>
  <rect x="${pad}" y="${tagY}" rx="18" ry="18" width="${tagW}" height="${tagH}" fill="#010212" fill-opacity="0.74" stroke="url(#neon)" stroke-width="2"/>
  <text x="${pad + tagPadX}" y="${tagY + Math.round(tagH / 2 + tagFont * 0.36)}" font-family="Inter, Arial, sans-serif" font-size="${tagFont}" font-weight="800" letter-spacing="3" fill="#e6f6ff">${escapeXml(tag)}</text>
  <text x="${pad}" y="${textY + fontSize}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="0" fill="#ffffff" filter="url(#shadow)">
    ${lines.map((line, i) => `<tspan x="${pad}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}
  </text>
  <rect x="${pad}" y="${brandY - 18}" width="${isStory ? 420 : 360}" height="5" rx="2.5" fill="url(#neon)"/>
  <text x="${pad}" y="${brandY + 28}" font-family="Inter, Arial, sans-serif" font-size="${isStory ? 30 : 24}" font-weight="800" letter-spacing="4" fill="#dffbff">DEVS A DERIVA</text>
</svg>`;
}

function cleanText(value: string): string {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyPhrase(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w.toLowerCase()));

  return words.slice(0, 4).join(" ") || limitWords(title, 4, 32) || "o assunto";
}

function limitWords(value: string, maxWords: number, maxChars: number): string {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > maxChars || next.split(/\s+/).length > maxWords) break;
    out = next;
  }
  return out || trimText(value, maxChars);
}

function trimText(value: string, max: number): string {
  const clean = cleanText(value);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

/**
 * Quebra em até maxLines SEM descartar palavra no meio (o bug antigo jogava fora
 * o resto do título ao atingir o limite). Se realmente não couber, marca
 * truncated (pro chamador tentar fonte menor) e fecha a última linha com "…".
 */
function wrapText(value: string, maxChars: number, maxLines: number): { lines: string[]; truncated: boolean } {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let truncated = false;

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      if (lines.length === maxLines - 1) {
        // última linha e ainda sobra palavra: não cabe neste tamanho de fonte
        truncated = true;
        current = trimText(current, maxChars - 1) + "…";
        break;
      }
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  if (!lines.length) lines.push(cleanText(value));
  return { lines: lines.slice(0, maxLines), truncated };
}

function slug(value: string): string {
  const normalized = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return normalized || "thumbnail";
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c] || c));
}
