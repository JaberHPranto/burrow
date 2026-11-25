import { usePersistentState } from "@/core/storage/usePersistentState";
import { cx } from "@/core/utils/cx";
import { Button, EmptyState, IconButton, Input, Row, TextArea } from "@/design";
import { Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type Note,
  createNote,
  filterNotes,
  notePreview,
  noteTitle,
  relativeTime,
  sortNotes,
  updateNote,
} from "./logic";
import styles from "./styles.module.css";

export default function QuickNotes() {
  const [notes, setNotes, loaded] = usePersistentState<Note[]>("quick-notes", "notes", []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => filterNotes(sortNotes(notes), query), [notes, query]);
  const selected = notes.find((n) => n.id === selectedId) ?? visible[0] ?? null;

  function addNote() {
    const note = createNote();
    setNotes((ns) => [note, ...ns]);
    setSelectedId(note.id);
    setQuery("");
  }

  function removeNote(id: string) {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    setSelectedId(null);
  }

  if (loaded && notes.length === 0) {
    return (
      <EmptyState
        title="No notes in the burrow"
        mood="sleepy"
        action={
          <Button variant="primary" icon={Plus} onClick={addNote}>
            New note
          </Button>
        }
      >
        Jot down commands, snippets and to-dos. Everything saves automatically.
      </EmptyState>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Row gap={2}>
          <Input
            icon={Search}
            placeholder="Search notes"
            aria-label="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <IconButton icon={Plus} label="New note" onClick={addNote} />
        </Row>
        <ul className={styles.list}>
          {visible.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cx(styles.item, n.id === selected?.id && styles.active)}
                onClick={() => setSelectedId(n.id)}
              >
                <span className={styles.itemTitle}>
                  {n.pinned && <Pin aria-label="Pinned" />}
                  {noteTitle(n)}
                </span>
                <span className={styles.itemPreview}>{notePreview(n) || " "}</span>
                <span className={styles.itemTime}>{relativeTime(n.updatedAt)}</span>
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className={styles.none}>No matches</li>}
        </ul>
      </aside>

      {selected && (
        <section className={styles.editor}>
          <Row gap={1}>
            <span className={styles.meta}>Edited {relativeTime(selected.updatedAt)}</span>
            <span className="b-grow" />
            <IconButton
              icon={selected.pinned ? PinOff : Pin}
              label={selected.pinned ? "Unpin" : "Pin"}
              onClick={() =>
                setNotes((ns) =>
                  ns.map((n) => (n.id === selected.id ? { ...n, pinned: !n.pinned } : n)),
                )
              }
            />
            <IconButton icon={Trash2} label="Delete note" onClick={() => removeNote(selected.id)} />
          </Row>
          <TextArea
            key={selected.id}
            aria-label="Note"
            className={styles.textarea}
            value={selected.body}
            placeholder="Start typing… the first line becomes the title."
            onChange={(e) => setNotes((ns) => updateNote(ns, selected.id, e.target.value))}
            autoFocus
          />
        </section>
      )}
    </div>
  );
}
