/**
 * Parse dotenv files and compare a real `.env` against `.env.example`.
 * Supports `export KEY=`, quotes, inline comments on unquoted values, and blank lines.
 */

export type EnvMap = Map<string, string>;

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)?$/;

export function parseEnv(text: string): EnvMap {
  const map: EnvMap = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    map.set(m[1] as string, unquote((m[2] ?? "").trim()));
  }
  return map;
}

function unquote(value: string): string {
  const q = value[0];
  if ((q === '"' || q === "'" || q === "`") && value.length >= 2) {
    const end = value.indexOf(q, 1);
    if (end > 0) return value.slice(1, end);
  }
  // Unquoted: strip a trailing " # comment"
  return value.replace(/\s+#.*$/, "");
}

export interface EnvDiff {
  /** In the example, missing from .env — the usual cause of "works on my machine". */
  missing: string[];
  /** In .env but not documented in the example. */
  extra: string[];
  /** Present in both but empty in .env. */
  empty: string[];
  /** Present and filled in both. */
  ok: string[];
}

export function diffEnv(env: EnvMap, example: EnvMap): EnvDiff {
  const diff: EnvDiff = { missing: [], extra: [], empty: [], ok: [] };
  for (const key of example.keys()) {
    if (!env.has(key)) diff.missing.push(key);
    else if (!env.get(key)) diff.empty.push(key);
    else diff.ok.push(key);
  }
  for (const key of env.keys()) if (!example.has(key)) diff.extra.push(key);
  for (const list of Object.values(diff)) list.sort();
  return diff;
}

/** Show only the shape of a secret: first 2 chars + bullets. */
export function maskValue(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}${"•".repeat(Math.min(10, value.length - 2))}`;
}

/** Build an updated .env.example that documents every key (values blanked). */
export function buildExample(env: EnvMap, example: EnvMap): string {
  const keys = [...new Set([...example.keys(), ...env.keys()])];
  return `${keys.map((k) => `${k}=${example.get(k) ?? ""}`).join("\n")}\n`;
}

export function detectEnv(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) return null;
  const matching = lines.filter((l) => /^\s*(export\s+)?[A-Z_][A-Z0-9_]*=/.test(l)).length;
  return matching / lines.length >= 0.8 ? { score: 0.65, label: "Compare .env" } : null;
}
