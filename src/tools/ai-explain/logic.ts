import { type AiPreset, MATERIAL_RULES, asMaterial } from "@/core/ai/ai";
import type { ClipboardMatch } from "@/core/tools/types";

const FOCUS = {
  auto: "Work out whether the material is code, an error/log/stack trace, a shell command, a config file or something else, and explain it accordingly: for an error give the likely cause and the fix; for code say what it does and flag bugs or risks.",
  error:
    "The material is an error message, log or stack trace. Explain in plain words what went wrong, the most likely cause, and how to fix it with concrete commands or code. Point to the relevant frame or line if there is one. If you need more context, say exactly what to check.",
  code: "The material is code. Explain what it does, step by step where that helps, then note anything surprising: bugs, edge cases, security or performance issues.",
} as const;

const DEPTH = {
  quick: "Keep it short: a few sentences or bullets. For an error, lead with the fix.",
  thorough: "Be thorough. Use ### headings and fenced code blocks where they help.",
} as const;

export const preset: AiPreset = {
  id: "ai-explain",
  action: "Explain",
  inputLabel: "Code, error or log",
  placeholder:
    "Paste a stack trace, a compiler error, a log, a regex, a shell command, a function…",
  inputKind: "code",
  output: "markdown",
  options: [
    {
      key: "focus",
      label: "It's",
      default: "auto",
      choices: [
        { value: "auto", label: "Auto-detect" },
        { value: "error", label: "An error" },
        { value: "code", label: "Code" },
      ],
    },
    {
      key: "depth",
      label: "Detail",
      default: "quick",
      choices: [
        { value: "quick", label: "Quick" },
        { value: "thorough", label: "Thorough" },
      ],
    },
  ],
  build(input, options) {
    const focus = FOCUS[(options.focus ?? "auto") as keyof typeof FOCUS] ?? FOCUS.auto;
    const depth = DEPTH[(options.depth ?? "quick") as keyof typeof DEPTH] ?? DEPTH.quick;
    return {
      system: [
        "You are a senior software engineer helping a colleague.",
        focus,
        depth,
        "Answer in markdown, in English.",
        MATERIAL_RULES,
      ].join(" "),
      user: `Explain this:\n\n${asMaterial(input)}`,
    };
  },
};

/** Patterns that are clearly an error, a stack trace or a failing command. Strongest first. */
const ERROR_PATTERNS: ReadonlyArray<readonly [RegExp, number]> = [
  [/Traceback \(most recent call last\)/, 0.85], // Python
  [/thread '[^']*' panicked at/, 0.85], // Rust runtime
  [/^\s+at (?:[\w$.<>[\] ]+ \()?\S+:\d+:\d+\)?\s*$/m, 0.8], // JS frames: at fn (file:1:2)
  [/^\s+at [\w$.<>]+\([\w$.]+:\d+\)\s*$/m, 0.8], // Java frames: at a.B.c(B.java:12)
  [/^Exception in thread "/m, 0.8], // Java
  [/^error(\[E\d{4}\])?: .+/m, 0.75], // Rust / C compilers
  [/^(Uncaught )?[A-Z]\w*(Error|Exception): .+/m, 0.7], // TypeError: …, ValueError: …
  [/^npm ERR!|^error Command failed|^fatal: /m, 0.65], // npm, yarn, git
  [/Segmentation fault|: command not found$|^panic: /m, 0.65], // shell, Go
];

/** Clipboard detector: offer “Explain this error” for stack traces and error output. */
export function detectError(text: string): ClipboardMatch | null {
  if (text.length > 50_000) return null;
  for (const [pattern, score] of ERROR_PATTERNS) {
    if (pattern.test(text)) return { score, label: "Explain this error" };
  }
  return null;
}
