// Ajuste de imagem por rede — cada rede tem limites próprios de proporção.
// Instagram: feed aceita entre 4:5 (0.8) e 1.91:1; fora disso o container é rejeitado.
// Threads: tolera até 10:1. LinkedIn não sobe imagem (usa o preview do link no blog).
// Estratégia: medir a imagem (sharp) e, se estourar o limite da rede, enquadrar num
// canvas de proporção válida via images.weserv.nl (letterbox com o fundo dark da
// marca), já convertida para JPEG.
import sharp from "sharp";

export interface Dims {
  width: number;
  height: number;
}

const WESERV = "https://images.weserv.nl/?url=";
const BG = "010212"; // fundo dark da identidade do blog
const JPEG = "&output=jpg&q=88";
const CANVAS_W = 1080; // largura padrão dos canvas (weserv amplia imagens pequenas)

const LIMITS: Record<"instagram" | "threads", { min: number; max: number }> = {
  instagram: { min: 4 / 5, max: 1.91 },
  threads: { min: 1 / 10, max: 10 },
};

/** Baixa a imagem e mede com sharp. null se não der (a publicação segue por fallback). */
export async function measure(url: string): Promise<Dims | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    if (!meta.width || !meta.height) return null;
    return { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** URL da imagem convertida p/ JPEG (sem mexer no tamanho). */
export function jpegUrl(url: string): string {
  return `${WESERV}${encodeURIComponent(url)}${JPEG}`;
}

/** URL da imagem enquadrada (letterbox) num canvas w×h com fundo da marca, em JPEG. */
export function paddedUrl(url: string, w: number, h: number): string {
  return `${WESERV}${encodeURIComponent(url)}&w=${w}&h=${h}&fit=contain&cbg=${BG}${JPEG}`;
}

/**
 * URLs candidatas para publicar a imagem na rede, em ordem de preferência.
 * Proporção dentro do limite: original → JPEG → quadrado (último recurso universal).
 * Proporção fora do limite: canvas na proporção máxima/mínima válida → quadrado
 * (a original seria rejeitada, então nem tenta).
 */
export async function candidates(network: "instagram" | "threads", url: string): Promise<string[]> {
  const { min, max } = LIMITS[network];
  const square = paddedUrl(url, CANVAS_W, CANVAS_W);
  const dims = await measure(url);
  if (!dims) return dedup([url, jpegUrl(url), square]);

  const ratio = dims.width / dims.height;
  // ceil/floor deixam o canvas um tico DENTRO do limite (arredondar pro outro lado estouraria)
  if (ratio > max) return dedup([paddedUrl(url, CANVAS_W, Math.ceil(CANVAS_W / max)), square]);
  if (ratio < min) return dedup([paddedUrl(url, CANVAS_W, Math.floor(CANVAS_W / min)), square]);
  return dedup([url, jpegUrl(url), square]);
}

function dedup(urls: string[]): string[] {
  return [...new Set(urls)];
}
