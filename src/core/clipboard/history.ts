/** Clipboard history model. Pure functions; persisted by ./historyStore.ts. */

export type ClipSource = "extension" | "launcher";

export interface ClipItem {
  id: string;
  text: string;
  /** Last time this text was copied (ms). */
  at: number;
  pinned?: boolean;
  source: ClipSource;
}

export interface AddOptions {
  maxItems: number;
  ignoreSecrets: boolean;
  now?: number;
  id?: string;
  source?: ClipSource;
}

const MAX_TEXT = 200_000;

/** Shannon entropy in bits per character. */
function entropy(s: string): number {
  const counts = new Map<string, number>();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const SECRET_PATTERNS: RegExp[] = [
  /^sk-(ant-|proj-|or-)?[A-Za-z0-9_-]{20,}$/, // OpenAI / Anthropic / OpenRouter keys
  /^(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}$/, // GitHub tokens
  /^AKIA[0-9A-Z]{16}$/, // AWS access key id
  /^xox[abprs]-[A-Za-z0-9-]{10,}$/, // Slack
  /^AIza[0-9A-Za-z_-]{35}$/, // Google API key
  /^eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private keys
  /^\d{6,8}$/, // OTP codes
];

/**
 * Does this look like something you wouldn't want in a history list?
 * Known token formats, OTP codes, private keys, or a single long random-looking token.
 */
export function looksSecret(text: string): boolean {
  const t = text.trim();
  if (SECRET_PATTERNS.some((re) => re.test(t))) return true;
  // Generic: one long token mixing cases and digits with high entropy (random password / key).
  if (/\s/.test(t) || t.length < 24 || t.length > 200) return false;
  if (/^https?:\/\//.test(t)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(t)).length;
  return classes === 3 && entropy(t) > 4.2;
}

/** Add a copied text: newest first, de-duplicated, capped (pinned items are always kept). */
export function addClip(items: readonly ClipItem[], text: string, opts: AddOptions): ClipItem[] {
  if (!text.trim() || text.length > MAX_TEXT) return [...items];
  if (opts.ignoreSecrets && looksSecret(text)) return [...items];
  const now = opts.now ?? Date.now();
  const existing = items.find((i) => i.text === text);
  const item: ClipItem = existing
    ? { ...existing, at: now }
    : { id: opts.id ?? crypto.randomUUID(), text, at: now, source: opts.source ?? "extension" };
  const rest = items.filter((i) => i.text !== text);
  return trim([item, ...rest], opts.maxItems);
}

/** Keep every pinned item plus the newest unpinned ones up to `max` total. */
export function trim(items: readonly ClipItem[], max: number): ClipItem[] {
  const pinned = items.filter((i) => i.pinned);
  let room = Math.max(0, max - pinned.length);
  return items.filter((i) => i.pinned || room-- > 0);
}

/** Pinned first, then most recent. */
export function sortClips(items: readonly ClipItem[]): ClipItem[] {
  return [...items].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at - a.at);
}

export function searchClips(items: readonly ClipItem[], query: string): ClipItem[] {
  const q = query.trim().toLowerCase();
  return q ? items.filter((i) => i.text.toLowerCase().includes(q)) : [...items];
}

export type ClipKind = "url" | "json" | "color" | "code" | "multiline" | "text";

/** Rough type, used for an icon. */
export function clipKind(text: string): ClipKind {
  const t = text.trim();
  if (/^https?:\/\/\S+$/.test(t)) return "url";
  if (/^#[0-9a-f]{3,8}$/i.test(t) || /^(rgb|hsl)a?\(/i.test(t)) return "color";
  if ((t.startsWith("{") || t.startsWith("[")) && t.length > 1) {
    try {
      JSON.parse(t);
      return "json";
    } catch {
      // not JSON
    }
  }
  if (/[{};]\s*$|^\s*(const|let|function|import|def|class|SELECT|<\w+)/m.test(t)) return "code";
  return t.includes("\n") ? "multiline" : "text";
}

/** First line, collapsed, for the list. */
export function preview(text: string, max = 140): string {
  const line = text.trim().replace(/\s+/g, " ");
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
