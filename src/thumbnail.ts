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
  const short = limitWords(title, 6, 44);
  const suggestions = [
    short,
    category ? `${category} na pratica` : `${keyPhrase} na pratica`,
    `O guia direto sobre ${keyPhrase}`,
    `O que muda com ${keyPhrase}`,
    `Evite erros em ${keyPhrase}`,
  ];

  return unique(suggestions)
    .map((s) => trimText(s, 46))
    .filter((s) => s.length >= 6)
    .slice(0, 5);
}

export async function generate(post: Post, req: ThumbnailRequest): Promise<ThumbnailResult> {
  if (!post.image) throw new Error("Este post nao tem imagem no RSS.");

  const format = req.format && FORMATS[req.format] ? req.format : "og";
  const spec = FORMATS[format];
  const text = trimText(cleanText(req.text), 70);
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
  const fontSize = isStory ? 96 : isSquare ? 76 : 74;
  const maxChars = isStory ? 15 : isSquare ? 17 : 22;
  const lines = wrapText(opts.title, maxChars, 3);
  const lineHeight = Math.round(fontSize * 1.08);
  const textHeight = lines.length * lineHeight;
  const textY = opts.height - pad - 68 - textHeight;
  const tagY = Math.max(pad, textY - 64);
  const brandY = opts.height - pad;

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
  <rect x="${pad}" y="${tagY}" rx="18" ry="18" width="${Math.min(520, opts.width - pad * 2)}" height="46" fill="#010212" fill-opacity="0.74" stroke="url(#neon)" stroke-width="2"/>
  <text x="${pad + 24}" y="${tagY + 31}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800" letter-spacing="3" fill="#e6f6ff">${escapeXml(limitWords(opts.category.toUpperCase(), 3, 28))}</text>
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

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (!lines.length) lines.push(cleanText(value));
  return lines.slice(0, maxLines);
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
