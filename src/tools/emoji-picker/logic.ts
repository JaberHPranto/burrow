/**
 * Emoji picker logic: turning emojibase data into a searchable list, search,
 * skin tones, copy formats, recents and 2-D grid keyboard navigation.
 * Pure: no React, no DOM.
 */

/** The subset of an emojibase-data `data.json` entry that we use. */
export interface RawEmoji {
  label: string;
  hexcode: string;
  emoji: string;
  group?: number;
  order?: number;
  version: number;
  tags?: string[];
  skins?: Array<{ emoji: string; tone?: number | number[] }>;
}

/** emojibase shortcode file: hexcode → one shortcode or several. */
export type ShortcodeMap = Record<string, string | string[]>;

export interface Emoji {
  emoji: string;
  label: string;
  hexcode: string;
  group: number;
  order: number;
  version: number;
  tags: string[];
  shortcodes: string[];
  /** Skin-tone variants, index 0 = tone 1 (light) … 4 = tone 5 (dark). */
  skins?: string[];
}

/** 0 = default (yellow), 1–5 = Fitzpatrick light → dark. */
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

/** emojibase groups shown as categories (group 2, "components", is skipped). */
export const GROUPS = [
  { id: 0, key: "smileys", label: "Smileys & emotion" },
  { id: 1, key: "people", label: "People & body" },
  { id: 3, key: "nature", label: "Animals & nature" },
  { id: 4, key: "food", label: "Food & drink" },
  { id: 5, key: "travel", label: "Travel & places" },
  { id: 6, key: "activities", label: "Activities" },
  { id: 7, key: "objects", label: "Objects" },
  { id: 8, key: "symbols", label: "Symbols" },
  { id: 9, key: "flags", label: "Flags" },
] as const;

const SHOWN_GROUPS = new Set<number>(GROUPS.map((g) => g.id));

/** Normalise emojibase data: drop components and ungrouped entries, attach shortcodes, sort. */
export function buildEmojis(data: RawEmoji[], shortcodes: ShortcodeMap = {}): Emoji[] {
  const out: Emoji[] = [];
  for (const raw of data) {
    if (raw.group === undefined || !SHOWN_GROUPS.has(raw.group)) continue;
    const codes = shortcodes[raw.hexcode];
    const emoji: Emoji = {
      emoji: raw.emoji,
      label: raw.label,
      hexcode: raw.hexcode,
      group: raw.group,
      order: raw.order ?? Number.MAX_SAFE_INTEGER,
      version: raw.version,
      tags: raw.tags ?? [],
      shortcodes: codes === undefined ? [] : Array.isArray(codes) ? codes : [codes],
    };
    // Only single-tone variants (multi-person emoji have tone pairs we don't offer).
    const skins = (raw.skins ?? []).filter((s) => typeof s.tone === "number");
    if (skins.length === 5) {
      emoji.skins = [...skins]
        .sort((a, b) => (a.tone as number) - (b.tone as number))
        .map((s) => s.emoji);
    }
    out.push(emoji);
  }
  return out.sort((a, b) => a.order - b.order);
}

/** Keep only emoji the system font can draw (see support.ts). */
export function supportedOnly(list: Emoji[], maxVersion: number): Emoji[] {
  return list.filter((e) => e.version <= maxVersion);
}

export function withSkin(e: Emoji, tone: SkinTone): string {
  if (tone === 0 || !e.skins) return e.emoji;
  return e.skins[tone - 1] ?? e.emoji;
}

/** Search by name, shortcode (":tada" or "tada") and tags. Best matches first. */
export function searchEmojis(list: Emoji[], query: string, limit = 200): Emoji[] {
  const q = query.trim().toLowerCase().replace(/^:|:$/g, "");
  if (!q) return list;
  const words = q.split(/\s+/);
  const scored: Array<{ e: Emoji; score: number }> = [];
  for (const e of list) {
    const score = scoreEmoji(e, q, words);
    if (score > 0) scored.push({ e, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.order - b.e.order)
    .slice(0, limit)
    .map((s) => s.e);
}

function scoreEmoji(e: Emoji, q: string, words: string[]): number {
  const label = e.label.toLowerCase();
  if (label === q || e.shortcodes.includes(q)) return 100;
  if (e.emoji === q) return 100;
  let score = 0;
  if (label.startsWith(q)) score = 80;
  else if (e.shortcodes.some((s) => s.startsWith(q))) score = 70;
  else if (label.split(/[\s:,-]+/).some((w) => w.startsWith(q))) score = 60;
  else if (e.tags.includes(q)) score = 50;
  else if (e.tags.some((t) => t.startsWith(q))) score = 40;
  else if (label.includes(q) || e.shortcodes.some((s) => s.includes(q))) score = 25;
  if (score > 0 || words.length < 2) return score;
  // Multi-word queries ("red heart"): every word must hit the label, a tag or a shortcode.
  const haystack = [label, ...e.tags, ...e.shortcodes].join(" ");
  return words.every((w) => haystack.includes(w)) ? 20 : 0;
}

/** "👋🏽" → "U+1F44B U+1F3FD" */
export function codepoints(text: string): string {
  return [...text]
    .map((ch) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

/** "👋" → "&#x1F44B;" (each code point, including variation selectors and ZWJ). */
export function htmlEntity(text: string): string {
  return [...text]
    .map((ch) => `&#x${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()};`)
    .join("");
}

/** Move a hexcode to the front of the recents, de-duplicated and capped. */
export function pushRecent(recents: string[], hexcode: string, max = 32): string[] {
  return [hexcode, ...recents.filter((h) => h !== hexcode)].slice(0, max);
}

/** Recent hexcodes → emoji, skipping any that no longer exist or aren't supported. */
export function resolveRecents(recents: string[], byHex: Map<string, Emoji>): Emoji[] {
  return recents.flatMap((h) => {
    const e = byHex.get(h);
    return e ? [e] : [];
  });
}

// ---------------------------------------------------------------------------
// Grid keyboard navigation. Sections (Recent, Smileys, …) each start a new row,
// so ↑/↓ moves between rows of different lengths and keeps the column when it can.

export interface GridLayout {
  /** Flat index of the first item of each row. */
  rowStart: number[];
  /** Number of items in each row. */
  rowLen: number[];
  /** Row of each flat index. */
  rowOf: number[];
}

export function layoutGrid(sectionSizes: number[], cols: number): GridLayout {
  const c = Math.max(1, Math.floor(cols));
  const layout: GridLayout = { rowStart: [], rowLen: [], rowOf: [] };
  let index = 0;
  for (const size of sectionSizes) {
    for (let start = 0; start < size; start += c) {
      const len = Math.min(c, size - start);
      const row = layout.rowStart.length;
      layout.rowStart.push(index);
      layout.rowLen.push(len);
      for (let i = 0; i < len; i++) layout.rowOf.push(row);
      index += len;
    }
  }
  return layout;
}

export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export function moveInGrid(index: number, key: GridKey, layout: GridLayout): number {
  const total = layout.rowOf.length;
  if (total === 0) return 0;
  const i = Math.min(Math.max(index, 0), total - 1);
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, i - 1);
    case "ArrowRight":
      return Math.min(total - 1, i + 1);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    case "ArrowUp":
    case "ArrowDown": {
      const row = layout.rowOf[i] ?? 0;
      const col = i - (layout.rowStart[row] ?? 0);
      const target = row + (key === "ArrowUp" ? -1 : 1);
      if (target < 0 || target >= layout.rowStart.length) return i;
      const len = layout.rowLen[target] ?? 1;
      return (layout.rowStart[target] ?? 0) + Math.min(col, len - 1);
    }
  }
}
