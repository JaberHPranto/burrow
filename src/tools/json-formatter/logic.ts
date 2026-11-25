export type Indent = "2" | "4" | "tab";

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line: number; column: number };

/** Parse JSON and, on failure, report a 1-based line/column for the error. */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { line, column } = locateError(text, message);
    return { ok: false, message: cleanMessage(message), line, column };
  }
}

function locateError(text: string, message: string): { line: number; column: number } {
  const lineCol = /line (\d+) column (\d+)/i.exec(message);
  if (lineCol) return { line: Number(lineCol[1]), column: Number(lineCol[2]) };

  const pos = /position (\d+)/i.exec(message);
  const offset = pos ? Number(pos[1]) : text.length;
  const before = text.slice(0, offset).split("\n");
  return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 };
}

function cleanMessage(message: string): string {
  return message
    .replace(/^JSON\.parse: /, "")
    .replace(/ in JSON at position \d+.*$/, "")
    .replace(/ \(line \d+ column \d+\)$/, "");
}

/** Recursively sort object keys (arrays keep their order). */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function formatJson(
  value: unknown,
  opts: { indent: Indent; minify: boolean; sortKeys: boolean },
): string {
  const data = opts.sortKeys ? sortKeysDeep(value) : value;
  if (opts.minify) return JSON.stringify(data);
  return JSON.stringify(data, null, opts.indent === "tab" ? "\t" : Number(opts.indent));
}

/** Count keys and values to show a quick summary. */
export function summarize(value: unknown): { keys: number; depth: number } {
  let keys = 0;
  const walk = (v: unknown, depth: number): number => {
    if (Array.isArray(v)) return Math.max(depth, ...v.map((x) => walk(x, depth + 1)));
    if (v && typeof v === "object") {
      const entries = Object.values(v as Record<string, unknown>);
      keys += entries.length;
      return Math.max(depth, ...entries.map((x) => walk(x, depth + 1)));
    }
    return depth;
  };
  const depth = walk(value, 0);
  return { keys, depth };
}

/** Clipboard detector: objects/arrays only — bare numbers or strings aren't worth suggesting. */
export function detectJson(text: string): { score: number; label: string } | null {
  const first = text[0];
  if (first !== "{" && first !== "[") return null;
  const result = parseJson(text);
  if (result.ok) return { score: 0.95, label: "Format JSON" };
  return { score: 0.6, label: "Fix JSON" };
}
