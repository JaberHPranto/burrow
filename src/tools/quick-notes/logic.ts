export interface Note {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

export function createNote(now = Date.now(), id: string = crypto.randomUUID()): Note {
  return { id, body: "", createdAt: now, updatedAt: now };
}

/** First non-empty line, stripped of markdown heading marks. */
export function noteTitle(note: Note): string {
  const line = note.body.split("\n").find((l) => l.trim());
  return line
    ? line
        .replace(/^#+\s*/, "")
        .trim()
        .slice(0, 80)
    : "Untitled note";
}

export function notePreview(note: Note): string {
  const lines = note.body.split("\n").filter((l) => l.trim());
  return lines.slice(1).join(" ").slice(0, 120);
}

export function updateNote(notes: Note[], id: string, body: string, now = Date.now()): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, body, updatedAt: now } : n));
}

/** Pinned first, then most recently edited. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt,
  );
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  return q ? notes.filter((n) => n.body.toLowerCase().includes(q)) : notes;
}

/** "just now", "5 min ago", "3 h ago", or a date. */
export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
