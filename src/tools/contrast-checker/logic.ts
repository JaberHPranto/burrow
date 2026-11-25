import { type Rgb, contrastRatio, looksLikeColor } from "@/core/color/color";

export interface WcagResult {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

/** WCAG 2.2 success criteria 1.4.3 (AA) and 1.4.6 (AAA). */
export function checkContrast(foreground: Rgb, background: Rgb): WcagResult {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

/** Display ratio like WebAIM: truncated (not rounded) to 2 decimals so 4.499 never shows as 4.50. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

export function detectColor(text: string) {
  return looksLikeColor(text) ? { score: 0.7, label: "Check contrast" } : null;
}
