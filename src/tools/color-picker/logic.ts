import { looksLikeColor, toHex } from "@/core/color/color";
import type { Rgb } from "@/core/color/color";

export const MAX_HISTORY = 16;

/** Most recent first, no duplicates, capped. */
export function pushHistory(history: readonly string[], color: Rgb): string[] {
  const hex = toHex(color);
  return [hex, ...history.filter((h) => h !== hex)].slice(0, MAX_HISTORY);
}

export function detectColor(text: string) {
  return looksLikeColor(text) ? { score: 0.75, label: "Convert colour" } : null;
}
