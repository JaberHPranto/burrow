/** App-wide settings: shape, defaults, and a forgiving merge for stored data. */
import type { AiProviderId, WindowMode } from "@/core/platform/commands";

export type ThemePreference = "dark" | "light" | "system";

export interface ProviderSettings {
  model: string;
  /** Empty = provider default. */
  baseUrl: string;
}

export interface Settings {
  theme: ThemePreference;
  showMascot: boolean;
  /** Launcher (hides on blur), pinned (stays open, on top) or a normal window. */
  windowMode: WindowMode;
  /** Suggest tools for what's on the clipboard when the launcher opens. */
  clipboardSuggestions: boolean;
  clipboard: {
    enabled: boolean;
    maxItems: number;
    /** Skip things that look like API keys, tokens, OTP codes, private keys. */
    ignoreSecrets: boolean;
  };
  ai: {
    defaultProvider: AiProviderId | null;
    providers: Record<AiProviderId, ProviderSettings>;
  };
}

export const AI_PROVIDERS: ReadonlyArray<{
  id: AiProviderId;
  name: string;
  needsKey: boolean;
  /** Placeholder for the base URL field; null hides the field. */
  baseUrlHint: string | null;
  keyHint: string;
}> = [
  { id: "anthropic", name: "Anthropic", needsKey: true, baseUrlHint: null, keyHint: "sk-ant-…" },
  {
    id: "openai",
    name: "OpenAI",
    needsKey: true,
    baseUrlHint: "https://api.openai.com/v1",
    keyHint: "sk-…",
  },
  { id: "openrouter", name: "OpenRouter", needsKey: true, baseUrlHint: null, keyHint: "sk-or-…" },
  {
    id: "ollama",
    name: "Ollama (local)",
    needsKey: false,
    baseUrlHint: "http://localhost:11434",
    keyHint: "",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    needsKey: false,
    baseUrlHint: "https://your-host/v1",
    keyHint: "optional",
  },
];

export const WINDOW_MODES = [
  "launcher",
  "pinned",
  "normal",
] as const satisfies readonly WindowMode[];

export const CLIPBOARD_SIZES = [50, 100, 200, 500] as const;

const emptyProvider = (): ProviderSettings => ({ model: "", baseUrl: "" });

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  showMascot: true,
  windowMode: "launcher",
  clipboardSuggestions: true,
  clipboard: { enabled: true, maxItems: 200, ignoreSecrets: true },
  ai: {
    defaultProvider: null,
    providers: {
      anthropic: emptyProvider(),
      openai: emptyProvider(),
      openrouter: emptyProvider(),
      ollama: emptyProvider(),
      custom: emptyProvider(),
    },
  },
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const oneOf = <T extends string>(v: unknown, options: readonly T[], d: T): T =>
  options.includes(v as T) ? (v as T) : d;

/**
 * Merge stored (possibly old, partial or hand-edited) settings over defaults,
 * dropping anything with the wrong type. Never throws.
 */
export function mergeSettings(stored: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isObj(stored)) return structuredClone(d);
  const clip = isObj(stored.clipboard) ? stored.clipboard : {};
  const ai = isObj(stored.ai) ? stored.ai : {};
  const storedProviders = isObj(ai.providers) ? ai.providers : {};
  const providerIds = Object.keys(d.ai.providers) as AiProviderId[];

  const providers = Object.fromEntries(
    providerIds.map((id) => {
      const p = isObj(storedProviders[id]) ? storedProviders[id] : {};
      return [
        id,
        {
          model: typeof p.model === "string" ? p.model : "",
          baseUrl: typeof p.baseUrl === "string" ? p.baseUrl : "",
        },
      ];
    }),
  ) as Record<AiProviderId, ProviderSettings>;

  const maxItems = Number(clip.maxItems);
  return {
    theme: oneOf(stored.theme, ["dark", "light", "system"] as const, d.theme),
    showMascot: bool(stored.showMascot, d.showMascot),
    // Older versions had a "hide when unfocused" switch; off meant "stay open".
    windowMode: oneOf(
      stored.windowMode,
      WINDOW_MODES,
      stored.hideOnBlur === false ? "pinned" : d.windowMode,
    ),
    clipboardSuggestions: bool(stored.clipboardSuggestions, d.clipboardSuggestions),
    clipboard: {
      enabled: bool(clip.enabled, d.clipboard.enabled),
      maxItems:
        Number.isInteger(maxItems) && maxItems >= 10 && maxItems <= 1000
          ? maxItems
          : d.clipboard.maxItems,
      ignoreSecrets: bool(clip.ignoreSecrets, d.clipboard.ignoreSecrets),
    },
    ai: {
      defaultProvider:
        ai.defaultProvider === null
          ? null
          : oneOf(ai.defaultProvider, providerIds, d.ai.defaultProvider ?? "anthropic"),
      providers,
    },
  };
}

/** Resolve "system" against the OS preference. */
export function resolveTheme(pref: ThemePreference, prefersDark: boolean): "dark" | "light" {
  return pref === "system" ? (prefersDark ? "dark" : "light") : pref;
}
