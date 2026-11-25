import { type AiPreset, MATERIAL_RULES, asMaterial } from "@/core/ai/ai";

const TONES = {
  clearer: "Make it clearer and easier to read: plain words, short sentences, a logical order.",
  shorter: "Make it about half as long. Cut filler and repetition but keep every key point.",
  friendly:
    "Make it warmer and friendlier while staying professional. Don't overdo exclamation marks.",
  formal: "Make it more formal and polished, suitable for a client or a manager.",
  casual: "Make it relaxed and conversational, like a message to a teammate.",
} as const;

export const preset: AiPreset = {
  id: "ai-rewrite",
  action: "Rewrite",
  inputLabel: "Text to rewrite",
  placeholder: "Paste a message, an email, a paragraph…",
  output: "text",
  reusable: true,
  options: [
    {
      key: "tone",
      label: "Make it",
      default: "clearer",
      choices: [
        { value: "clearer", label: "Clearer" },
        { value: "shorter", label: "Shorter" },
        { value: "friendly", label: "Friendlier" },
        { value: "formal", label: "More formal" },
        { value: "casual", label: "More casual" },
      ],
    },
  ],
  build(input, options) {
    const tone = TONES[(options.tone ?? "clearer") as keyof typeof TONES] ?? TONES.clearer;
    return {
      system: [
        "You rewrite text for the user.",
        "Keep the meaning, facts, names, numbers, links and the original language.",
        "Keep the format: an email stays an email, a list stays a list, markdown stays markdown, code stays untouched.",
        tone,
        MATERIAL_RULES,
        "Return only the rewritten text.",
      ].join(" "),
      user: `Rewrite this:\n\n${asMaterial(input)}`,
    };
  },
};
