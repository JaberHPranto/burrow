/** Shared colour utilities (sRGB). Used by the contrast checker, palette tool, etc. */

export interface Rgb {
  r: number; // 0–255
  g: number;
  b: number;
  a?: number; // 0–1
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Parse #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla(). Returns null if invalid. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase();

  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1] as string;
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), ...(h.length === 8 ? { a: n(6) / 255 } : {}) };
  }

  const fn = /^(rgba?|hsla?)\(\s*([^)]+)\)$/.exec(s);
  if (!fn) return null;
  const parts = (fn[2] as string).split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (p: string, scale: number) =>
    p.endsWith("%") ? (Number.parseFloat(p) / 100) * scale : Number.parseFloat(p);
  const alpha = parts[3] !== undefined ? clamp(num(parts[3], 1), 0, 1) : undefined;

  if ((fn[1] as string).startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((p) => clamp(Math.round(num(p, 255)), 0, 255));
    if ([r, g, b].some((v) => v === undefined || Number.isNaN(v))) return null;
    return {
      r: r as number,
      g: g as number,
      b: b as number,
      ...(alpha !== undefined ? { a: alpha } : {}),
    };
  }

  const h = Number.parseFloat(parts[0] as string);
  const sat = clamp(num(parts[1] as string, 1), 0, 1);
  const light = clamp(num(parts[2] as string, 1), 0, 1);
  if ([h, sat, light].some(Number.isNaN)) return null;
  return { ...hslToRgb(h, sat, light), ...(alpha !== undefined ? { a: alpha } : {}) };
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: Math.round(h * 60 + 360) % 360, s, l };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio, 1–21. Alpha is ignored (colours are treated as opaque). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Squared distance — cheap similarity for quantisation and matching. */
export function distanceSq(a: Rgb, b: Rgb): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

/** Is the text a single colour value? Used by clipboard detectors. */
export function looksLikeColor(text: string): boolean {
  return (
    text.length <= 40 &&
    !/\s{2,}|\n/.test(text) &&
    parseColor(text) !== null &&
    /^#|^rgb|^hsl/i.test(text.trim())
  );
}

/** sRGB → OKLCH (Björn Ottosson's OKLab). L 0–1, C ≥ 0, H 0–360 degrees. */
export function rgbToOklch({ r, g, b }: Rgb): { l: number; c: number; h: number } {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.sqrt(A * A + B * B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** All the CSS notations a developer might want to copy. */
export function colorFormats(rgb: Rgb): Record<"hex" | "rgb" | "hsl" | "oklch", string> {
  const { h, s, l } = rgbToHsl(rgb);
  const ok = rgbToOklch(rgb);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return {
    hex: toHex(rgb),
    rgb: `rgb(${rgb.r} ${rgb.g} ${rgb.b})`,
    hsl: `hsl(${h} ${pct(s)} ${pct(l)})`,
    oklch: `oklch(${(ok.l * 100).toFixed(1)}% ${ok.c.toFixed(3)} ${ok.h.toFixed(1)})`,
  };
}

/** Pick ink or white text for legibility on a background colour. */
export function readableOn(bg: Rgb): "#181a20" | "#ffffff" {
  return relativeLuminance(bg) > 0.4 ? "#181a20" : "#ffffff";
}
