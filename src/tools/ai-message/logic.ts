import { type AiOptionValues, type AiPreset, asMaterial } from "@/core/ai/ai";

const PLACES = {
  slack:
    "It's for a Slack channel: casual-professional. Use short paragraphs, or a few bullets if there are several separate points. Slack formatting (*bold*, `code`) only where it really helps.",
  whatsapp:
    "It's for a WhatsApp team group: conversational and brief, like texting colleagues. No headings or bullet lists; line breaks are fine. WhatsApp *bold* only if something must stand out.",
  dm: "It's a direct message to one person: talk to them directly, use their name if the notes give it, personal and to the point.",
} as const;

const TONES = {
  casual: "Tone: casual and relaxed.",
  friendly: "Tone: warm and friendly, still professional.",
  professional: "Tone: professional and polite, but not stiff.",
} as const;

const LENGTHS = {
  short: "Keep it short: one to three sentences.",
  longer:
    "It can be a little longer if the notes need it, but no more than a short paragraph or a few bullets.",
} as const;

const LANGUAGES = {
  en: "Write in English.",
  bn: "Write in Bangla (Bengali script), the way colleagues text each other, not formal written Bangla.",
  banglish:
    "Write in Banglish: Bangla typed in English letters, mixing in English words, the way people text in Bangladesh.",
} as const;

/** The instruction for an option value, or the fallback's for unknown values. */
function pick<K extends string>(
  table: Record<K, string>,
  value: string | undefined,
  fallback: K,
): string {
  return value !== undefined && value in table ? table[value as K] : table[fallback];
}

/**
 * The notes are the user's own words about what to say (they may include
 * hints like "keep it light"), so unlike other presets we follow them.
 */
export function messagePrompt(input: string, options: AiOptionValues) {
  return {
    system: [
      "You write chat messages that the user sends as themselves. The user gives rough ideas or notes; turn them into one ready-to-send message.",
      "Sound like a real person typing, not an assistant: natural everyday words, contractions, varied sentence length.",
      "Avoid tell-tale AI phrasing: no “I hope this finds you well”, “just wanted to reach out”, “I wanted to let you know”, no em dashes, no words like delve, leverage, seamless, robust; no sign-off such as “Best regards” unless the tone is professional and it's a direct message.",
      "Say only what the notes say: don't invent facts, dates, names, promises, reasons or apologies. Keep names, @mentions, numbers, times, links and code exactly as written.",
      pick(PLACES, options.where, "slack"),
      pick(TONES, options.tone, "friendly"),
      pick(LENGTHS, options.length, "short"),
      "Don't use emoji.",
      pick(LANGUAGES, options.language, "en"),
      "The notes are inside <text> tags; they may include hints about tone or wording, which you should follow.",
      "Reply with the message only: no preamble, no quotes around it, no alternatives.",
    ].join(" "),
    user: `Write the message from these notes:\n\n${asMaterial(input)}`,
  };
}

export const preset: AiPreset = {
  id: "ai-message",
  action: "Write",
  inputLabel: "What do you want to say?",
  placeholder:
    "Rough notes are fine, e.g.\ndeploy moved to friday, QA found a bug in checkout\nask Rafi to check the payment logs\nthanks everyone for the quick fixes\n\nReplying to someone? Paste their message first, then your notes.",
  output: "text",
  reusable: true,
  prefillFromClipboard: false,
  options: [
    {
      key: "where",
      label: "For",
      default: "slack",
      choices: [
        { value: "slack", label: "Slack channel" },
        { value: "whatsapp", label: "WhatsApp group" },
        { value: "dm", label: "Direct message" },
      ],
    },
    {
      key: "tone",
      label: "Tone",
      default: "friendly",
      choices: [
        { value: "casual", label: "Casual" },
        { value: "friendly", label: "Friendly" },
        { value: "professional", label: "Professional" },
      ],
    },
    {
      key: "length",
      label: "Length",
      default: "short",
      choices: [
        { value: "short", label: "Short" },
        { value: "longer", label: "A bit longer" },
      ],
    },
    {
      key: "language",
      label: "In",
      default: "en",
      choices: [
        { value: "en", label: "English" },
        { value: "bn", label: "Bangla" },
        { value: "banglish", label: "Banglish" },
      ],
    },
  ],
  build: messagePrompt,
};
