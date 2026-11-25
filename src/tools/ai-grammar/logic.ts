import { type AiPreset, MATERIAL_RULES, asMaterial } from "@/core/ai/ai";

const MODES = {
  fix: "Change only what is wrong; leave correct sentences exactly as they are.",
  polish:
    "Also smooth awkward or unclear sentences, keeping roughly the same length, tone and structure.",
} as const;

export const preset: AiPreset = {
  id: "ai-grammar",
  action: "Fix",
  inputLabel: "Your text",
  placeholder:
    "Paste a message, a PR description, docs… Spelling and grammar get fixed, your voice stays.",
  output: "text",
  reusable: true,
  options: [
    {
      key: "mode",
      label: "Edits",
      default: "fix",
      choices: [
        { value: "fix", label: "Only mistakes" },
        { value: "polish", label: "Mistakes + polish" },
      ],
    },
  ],
  build(input, options) {
    const mode = MODES[(options.mode ?? "fix") as keyof typeof MODES] ?? MODES.fix;
    return {
      system: [
        "You are a careful copy editor. Fix spelling, grammar, punctuation and capitalisation.",
        "Keep the author's meaning, voice, language and spelling variety (US/UK). Never translate.",
        "Preserve formatting exactly: line breaks, markdown, lists, code blocks, inline code, URLs, @mentions and emoji. Don't touch code.",
        mode,
        "If nothing needs fixing, return the text unchanged.",
        MATERIAL_RULES,
        "Return only the corrected text.",
      ].join(" "),
      user: `Correct this:\n\n${asMaterial(input)}`,
    };
  },
};
