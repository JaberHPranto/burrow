/** Word count and reading time (≈220 wpm), ignoring code fences and markup. */
export function documentStats(markdown: string): { words: number; minutes: number } {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-|]/g, " ");
  const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { words, minutes: Math.max(1, Math.round(words / 220)) };
}

/** Clipboard detector: needs at least two distinct markdown signals to avoid false positives. */
export function detectMarkdown(text: string) {
  if (!text.includes("\n")) return null;
  const signals = [
    /^#{1,6}\s+\S/m, // heading
    /^\s*[-*+]\s+\S/m, // bullet list
    /^\s*\d+\.\s+\S/m, // numbered list
    /```/, // code fence
    /\[[^\]]+\]\([^)]+\)/, // link
    /^\s*>\s+\S/m, // quote
    /\*\*[^*]+\*\*/, // bold
    /^\|.+\|$/m, // table
  ].filter((re) => re.test(text)).length;
  return signals >= 2 ? { score: 0.6, label: "Preview Markdown" } : null;
}
