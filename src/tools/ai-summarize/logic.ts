import { type AiPreset, MATERIAL_RULES, asMaterial } from "@/core/ai/ai";
import type { ClipboardMatch } from "@/core/tools/types";

const STYLES = {
  tldr: "Reply with a single sentence of at most 30 words.",
  bullets:
    "Start with a one-line bold takeaway, then 3–7 short markdown bullet points, most important first.",
  detailed:
    "Start with a short overview paragraph, then markdown sections (### headings) for the main points. End with an “Action items” list only if the text implies any.",
} as const;

export const preset: AiPreset = {
  id: "ai-summarize",
  action: "Summarise",
  inputLabel: "Text to summarise",
  placeholder: "Paste an article, a thread, meeting notes, a long email…",
  output: "markdown",
  options: [
    {
      key: "length",
      label: "Length",
      default: "bullets",
      choices: [
        { value: "tldr", label: "One line" },
        { value: "bullets", label: "Key points" },
        { value: "detailed", label: "Detailed" },
      ],
    },
  ],
  build(input, options) {
    const style = STYLES[(options.length ?? "bullets") as keyof typeof STYLES] ?? STYLES.bullets;
    return {
      system: [
        "You summarise text for a busy software developer.",
        "Be faithful: include nothing that isn't in the text. Keep names, numbers, dates, versions, commands and links exactly as written.",
        "Write in the same language as the text.",
        style,
        MATERIAL_RULES,
      ].join(" "),
      user: `Summarise this:\n\n${asMaterial(input)}`,
    };
  },
};

/** Long prose (an article, a thread) — but not code, JSON or markup. */
export function detectLongProse(text: string): ClipboardMatch | null {
  if (text.length < 700) return null;
  if (/^\s*[{[<]/.test(text)) return null;
  const sentences = text.match(/[.!?…](\s|$)/g)?.length ?? 0;
  if (sentences < 5) return null;
  const nonSpace = text.replace(/\s/g, "").length;
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const codey = text.match(/[;{}=<>$|\\]/g)?.length ?? 0;
  if (letters / nonSpace < 0.7 || codey / nonSpace > 0.02) return null;
  return { score: 0.55, label: "Summarise this text" };
}
