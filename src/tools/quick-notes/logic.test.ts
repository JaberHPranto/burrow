import { describe, expect, it } from "vitest";
import {
  createNote,
  filterNotes,
  notePreview,
  noteTitle,
  relativeTime,
  sortNotes,
  updateNote,
} from "./logic";

const note = (id: string, body: string, updatedAt: number, pinned = false) => ({
  ...createNote(updatedAt, id),
  body,
  pinned,
});

describe("notes", () => {
  it("derives title and preview", () => {
    const n = note("a", "\n# Standup\n- shipped burrow\n- review PR", 1);
    expect(noteTitle(n)).toBe("Standup");
    expect(notePreview(n)).toBe("- shipped burrow - review PR");
    expect(noteTitle(note("b", "   ", 1))).toBe("Untitled note");
  });

  it("updates body and timestamp of one note", () => {
    const notes = [note("a", "x", 1), note("b", "y", 1)];
    const next = updateNote(notes, "b", "z", 99);
    expect(next[1]).toMatchObject({ body: "z", updatedAt: 99 });
    expect(next[0]).toBe(notes[0]);
  });

  it("sorts pinned first, then newest", () => {
    const sorted = sortNotes([note("old", "", 1), note("new", "", 3), note("pin", "", 0, true)]);
    expect(sorted.map((n) => n.id)).toEqual(["pin", "new", "old"]);
  });

  it("filters case-insensitively", () => {
    const notes = [note("a", "Docker tips", 1), note("b", "groceries", 1)];
    expect(filterNotes(notes, "docker").map((n) => n.id)).toEqual(["a"]);
    expect(filterNotes(notes, " ")).toHaveLength(2);
  });

  it("formats relative times", () => {
    expect(relativeTime(1000, 10_000)).toBe("just now");
    expect(relativeTime(0, 5 * 60_000)).toBe("5 min ago");
    expect(relativeTime(0, 3 * 3_600_000)).toBe("3 h ago");
  });
});
