export type Layout = "lines" | "paragraphs";

const LIST_ITEM = /^\s*([-*•‣◦]|\d+[.)])\s+/;

/**
 * Tidy raw tesseract output.
 * - lines:      keep line breaks, trim trailing spaces, collapse blank runs
 * - paragraphs: also re-join words hyphenated across lines and merge wrapped
 *               lines into paragraphs (list items keep their own line)
 */
export function cleanOcrText(raw: string, layout: Layout): string {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (layout === "lines") return text;

  return text
    .split(/\n{2,}/)
    .map((block) => {
      const out: string[] = [];
      for (const line of block.split("\n")) {
        const prev = out.at(-1);
        if (prev === undefined || LIST_ITEM.test(line)) {
          out.push(line.trim());
        } else if (/\p{L}-$/u.test(prev) && /^\s*\p{Ll}/u.test(line)) {
          out[out.length - 1] = prev.slice(0, -1) + line.trim(); // "exam-" + "ple"
        } else {
          out[out.length - 1] = `${prev} ${line.trim()}`;
        }
      }
      return out.join("\n").replace(/ {2,}/g, " ");
    })
    .join("\n\n");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Language choices offered from what tesseract has installed. */
export function languageOptions(
  installed: readonly string[],
): Array<{ value: string; label: string }> {
  const names: Record<string, string> = {
    eng: "English",
    ben: "Bangla",
    hin: "Hindi",
    ara: "Arabic",
    msa: "Malay",
  };
  const opts = installed.map((code) => ({ value: code, label: names[code] ?? code }));
  if (installed.includes("eng") && installed.includes("ben"))
    opts.push({ value: "eng+ben", label: "English + Bangla" });
  return opts;
}
