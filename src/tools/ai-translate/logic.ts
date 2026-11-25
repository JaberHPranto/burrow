import { type AiPreset, MATERIAL_RULES, asMaterial, choiceLabel } from "@/core/ai/ai";
import type { ClipboardMatch } from "@/core/tools/types";

const LANGUAGES = [
  ["en", "English"],
  ["bn", "Bangla (Bengali)"],
  ["hi", "Hindi"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["zh", "Chinese (Simplified)"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["id", "Indonesian"],
  ["ms", "Malay"],
  ["tr", "Turkish"],
  ["ru", "Russian"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["nl", "Dutch"],
] as const;

const STYLES = {
  natural:
    "Make it sound natural to a native speaker; adapt idioms rather than translating word for word.",
  literal: "Stay close to the original wording and sentence structure.",
} as const;

export const preset: AiPreset = {
  id: "ai-translate",
  action: "Translate",
  inputLabel: "Text to translate",
  placeholder: "Paste text in any language…",
  output: "text",
  options: [
    {
      key: "to",
      label: "To",
      default: "en",
      choices: LANGUAGES.map(([value, label]) => ({ value, label })),
    },
    {
      key: "style",
      label: "Style",
      default: "natural",
      choices: [
        { value: "natural", label: "Natural" },
        { value: "literal", label: "Literal" },
      ],
    },
  ],
  build(input, options) {
    const language = choiceLabel(preset, "to", options);
    const style = STYLES[(options.style ?? "natural") as keyof typeof STYLES] ?? STYLES.natural;
    return {
      system: [
        `You are a professional translator. Translate the material into ${language}.`,
        "Keep the meaning, tone and formatting (line breaks, markdown, lists). Don't translate code, commands, file paths, URLs or product names.",
        style,
        `If the material is already in ${language}, return it unchanged.`,
        MATERIAL_RULES,
        "Return only the translation.",
      ].join(" "),
      user: `Translate this into ${language}:\n\n${asMaterial(input)}`,
    };
  },
};

/** Text written mostly in a non-Latin script (Bangla, Arabic, Chinese…). */
export function detectForeignScript(text: string): ClipboardMatch | null {
  if (text.length > 50_000) return null;
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 10) return null;
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if ((letters - latin) / letters < 0.6) return null;
  return { score: 0.6, label: "Translate this text" };
}
