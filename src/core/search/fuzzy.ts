/**
 * Tiny fuzzy scorer for the launcher. Ranks, best first:
 * exact > prefix > word-prefix > substring > in-order subsequence.
 * Returns 0 for no match.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80 - Math.min(t.length - q.length, 20) * 0.1;
  if (t.split(/[\s\-_./]+/).some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 45;

  // Subsequence: every query char appears in order; reward tight clusters.
  let ti = 0;
  let gaps = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    gaps += found - ti;
    ti = found + 1;
  }
  return Math.max(1, 30 - gaps);
}

/** Best score across several fields; the first field (usually the name) is weighted up. */
export function scoreFields(query: string, fields: readonly string[]): number {
  let best = 0;
  fields.forEach((field, i) => {
    const s = fuzzyScore(query, field) * (i === 0 ? 1 : 0.85);
    if (s > best) best = s;
  });
  return best;
}
