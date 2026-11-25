/**
 * Which emoji can this system draw? emojibase includes emoji up to the latest
 * Unicode release, but Ubuntu's Noto Color Emoji lags behind, and unsupported
 * emoji show up as empty boxes or as several glyphs side by side. We draw a few
 * emoji from each version on a canvas and keep the versions that render as one
 * coloured glyph. Runs once per app session (~30 tiny canvas draws).
 */
import type { Emoji } from "./logic";

/** Emoji ≤ this version are in every font we care about (Noto shipped 11 in 2018). */
const BASELINE_VERSION = 11;
const SIZE = 24;
export const EMOJI_FONT = `"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Twemoji Mozilla", sans-serif`;

let cached: number | null = null;

export function detectMaxEmojiVersion(list: Emoji[]): number {
  if (cached !== null) return cached;
  cached = detect(list);
  return cached;
}

function detect(list: Emoji[]): number {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * 3;
  canvas.height = SIZE * 1.5;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Number.POSITIVE_INFINITY;
  ctx.font = `${SIZE}px ${EMOJI_FONT}`;
  ctx.textBaseline = "top";

  const refWidth = ctx.measureText("😀").width;
  // No colour emoji font at all (or canvas blocked): we can't tell, so show everything.
  if (!isColourGlyph(ctx, "😀", refWidth)) return Number.POSITIVE_INFINITY;

  const versions = [...new Set(list.map((e) => e.version))]
    .filter((v) => v > BASELINE_VERSION)
    .sort((a, b) => a - b);

  let max = BASELINE_VERSION;
  for (const version of versions) {
    // Flags are letter pairs and render differently; probe other emoji.
    const probes = list.filter((e) => e.version === version && e.group !== 9).slice(0, 3);
    if (probes.length === 0) continue;
    const ok = probes.filter((e) => isColourGlyph(ctx, e.emoji, refWidth)).length;
    if (ok * 2 < probes.length) break;
    max = version;
  }
  return max;
}

/** One glyph wide and drawn in colour (a missing-glyph box is drawn in the fill colour). */
function isColourGlyph(ctx: CanvasRenderingContext2D, text: string, refWidth: number): boolean {
  if (ctx.measureText(text).width > refWidth * 1.4) return false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillText(text, 0, 0);
  const { data } = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    if (a > 100 && Math.max(r, g, b) - Math.min(r, g, b) > 40) return true;
  }
  return false;
}
