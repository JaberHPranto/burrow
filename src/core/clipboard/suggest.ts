import type { ClipboardMatch, ToolDefinition } from "../tools/types";

export interface Suggestion {
  tool: ToolDefinition;
  match: ClipboardMatch;
}

const MIN_SCORE = 0.5;
/** Very large clipboards are skipped so detection never blocks the launcher. */
const MAX_LENGTH = 200_000;

/**
 * Ask every tool's `detect` whether it can act on the clipboard text.
 * Detectors that throw are ignored — one broken tool must not break the launcher.
 */
export function suggestForClipboard(
  text: string,
  tools: readonly ToolDefinition[],
  limit = 3,
): Suggestion[] {
  const input = text.trim();
  if (!input || input.length > MAX_LENGTH) return [];

  const results: Suggestion[] = [];
  for (const tool of tools) {
    if (!tool.detect) continue;
    try {
      const match = tool.detect(input);
      if (match && match.score >= MIN_SCORE) results.push({ tool, match });
    } catch {
      // ignore faulty detector
    }
  }
  return results.sort((a, b) => b.match.score - a.match.score).slice(0, limit);
}
