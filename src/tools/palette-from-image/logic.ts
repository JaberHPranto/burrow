import { type Rgb, distanceSq, rgbToHsl, toHex } from "@/core/color/color";

export interface PaletteColor {
  hex: string;
  rgb: Rgb;
  /** Fraction of (opaque) pixels closest to this colour, 0–1. */
  share: number;
}

/**
 * Extract a palette from RGBA pixel data with k-means.
 * Deterministic: seeds from the most common coarse (4-bit) colour bins, so the
 * same image always gives the same palette. Transparent pixels are ignored.
 */
export function extractPalette(pixels: Uint8ClampedArray, k = 6, iterations = 10): PaletteColor[] {
  const points: Rgb[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] as number) < 128) continue;
    points.push({ r: pixels[i] as number, g: pixels[i + 1] as number, b: pixels[i + 2] as number });
  }
  if (points.length === 0) return [];

  let centroids = seedCentroids(points, k);
  let assignment = new Array<number>(points.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    assignment = points.map((p) => nearest(p, centroids));
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    points.forEach((p, i) => {
      const s = sums[assignment[i] as number] as { r: number; g: number; b: number; n: number };
      s.r += p.r;
      s.g += p.g;
      s.b += p.b;
      s.n += 1;
    });
    centroids = sums.map((s, i) =>
      s.n ? { r: s.r / s.n, g: s.g / s.n, b: s.b / s.n } : (centroids[i] as Rgb),
    );
  }

  const counts = new Array<number>(centroids.length).fill(0);
  for (const a of assignment) counts[a] = (counts[a] as number) + 1;

  return centroids
    .map((c, i) => {
      const rgb = { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
      return { hex: toHex(rgb), rgb, share: (counts[i] as number) / points.length };
    })
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

function seedCentroids(points: Rgb[], k: number): Rgb[] {
  const bins = new Map<number, { color: Rgb; n: number }>();
  for (const p of points) {
    const key = ((p.r >> 4) << 8) | ((p.g >> 4) << 4) | (p.b >> 4);
    const bin = bins.get(key);
    if (bin) bin.n += 1;
    else bins.set(key, { color: p, n: 1 });
  }
  const ranked = [...bins.values()].sort((a, b) => b.n - a.n);
  const seeds: Rgb[] = [];
  // Prefer seeds that are visibly different from each other.
  for (const minDist of [48 ** 2, 24 ** 2, 0]) {
    for (const { color } of ranked) {
      if (seeds.length >= k) break;
      if (seeds.every((s) => distanceSq(s, color) > minDist)) seeds.push(color);
    }
  }
  return seeds;
}

function nearest(p: Rgb, centroids: Rgb[]): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  centroids.forEach((c, i) => {
    const d = distanceSq(p, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export type ExportFormat = "hex" | "css" | "tailwind";

/** Sort by lightness for exports so scales read dark → light. */
export function exportPalette(colors: PaletteColor[], format: ExportFormat): string {
  const ordered = [...colors].sort((a, b) => rgbToHsl(a.rgb).l - rgbToHsl(b.rgb).l);
  switch (format) {
    case "hex":
      return ordered.map((c) => c.hex).join("\n");
    case "css":
      return `:root {\n${ordered.map((c, i) => `  --palette-${(i + 1) * 100}: ${c.hex};`).join("\n")}\n}`;
    case "tailwind":
      return `colors: {\n  palette: {\n${ordered
        .map((c, i) => `    ${(i + 1) * 100}: "${c.hex}",`)
        .join("\n")}\n  },\n},`;
  }
}
