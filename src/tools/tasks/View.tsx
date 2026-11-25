import { usePersistentState } from "@/core/storage/usePersistentState";
import { cx } from "@/core/utils/cx";
import { Button, EmptyState, IconButton, Input, Row, Segmented, Tag } from "@/design";
import {
  CalendarDays,
  Check,
  Flag,
  Hash,
  Inbox,
  ListChecks,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Priority,
  type Task,
  type View,
  allTags,
  countByView,
  createTask,
  dueLabel,
  filterTasks,
  groupTasks,
  parseQuickAdd,
  toDay,
  toggleDone,
} from "./logic";
import styles from "./styles.module.css";

const VIEWS: ReadonlyArray<{ id: View; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
  { id: "all", label: "All open", icon: Inbox },
  { id: "done", label: "Completed", icon: ListChecks },
];

const PRIORITY_TONE = { high: "coral", medium: "butter", low: "aqua" } as const;

const EMPTY_COPY: Record<View, { title: string; body: string }> = {
  today: {
    title: "Nothing due today",
    body: "Hop over to Upcoming, or add something with “today”.",
  },
  upcoming: { title: "Clear skies ahead", body: "Add a date like “fri”, “dec 5” or “in 3 days”." },
  all: { title: "No open tasks", body: "Type a task above. Try: Review PR !high #work tomorrow" },
  done: { title: "Nothing completed yet", body: "Tick a task and it lands here." },
};

/** Re-render at midnight so "Today" stays correct when Burrow runs for days. */
function useToday(): string {
  const [today, setToday] = useState(() => toDay(new Date()));
  useEffect(() => {
    const t = setInterval(() => setToday(toDay(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export default function Tasks() {
  const [tasks, setTasks] = usePersistentState<Task[]>("tasks", "tasks", []);
  const [view, setView] = useState<View>("today");
  const [tag, setTag] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = useToday();
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseQuickAdd(draft, today), [draft, today]);
  const counts = useMemo(() => countByView(tasks, today), [tasks, today]);
  const tags = useMemo(() => allTags(tasks), [tasks]);
  const visible = useMemo(() => filterTasks(tasks, view, today, tag), [tasks, view, today, tag]);
  const groups = useMemo(
    () =>
      view === "done"
        ? [{ group: "Completed" as const, tasks: visible }]
        : groupTasks(visible, today),
    [visible, view, today],
  );

  const update = (id: string, patch: Partial<Task>) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function add() {
    if (!parsed.title) return;
    // A task added from "Today" with no date is clearly meant for today.
    const due = parsed.due ?? (view === "today" ? today : null);
    const tagsWithFilter = tag && !parsed.tags.includes(tag) ? [...parsed.tags, tag] : parsed.tags;
    setTasks((ts) => [...ts, createTask({ ...parsed, due, tags: tagsWithFilter })]);
    setDraft("");
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar} aria-label="Task lists">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cx(styles.navItem, view === id && styles.navActive)}
            onClick={() => setView(id)}
          >
            <Icon aria-hidden />
            <span className="b-grow">{label}</span>
            <span className={styles.count}>{counts[id]}</span>
          </button>
        ))}
        {tags.length > 0 && (
          <>
            <span className={styles.navTitle}>Tags</span>
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                className={cx(styles.navItem, tag === t && styles.navActive)}
                onClick={() => setTag((cur) => (cur === t ? null : t))}
              >
                <Hash aria-hidden />
                <span className="b-grow">{t}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      <section className={styles.main}>
        {view !== "done" && (
          <form
            className={styles.quickAdd}
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              ref={inputRef}
              icon={Plus}
              aria-label="Add a task"
              placeholder="Add a task… e.g. Review PR !high #work tomorrow"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            {draft.trim() && (
              <Row gap={1} className={styles.preview}>
                <span className={styles.previewTitle}>{parsed.title || "…"}</span>
                {parsed.due && <Tag icon={CalendarDays}>{dueLabel(parsed.due, today)}</Tag>}
                {parsed.priority && (
                  <Tag tone={PRIORITY_TONE[parsed.priority]} icon={Flag}>
                    {parsed.priority}
                  </Tag>
                )}
                {parsed.tags.map((t) => (
                  <Tag key={t} icon={Hash}>
                    {t}
                  </Tag>
                ))}
                <span className="b-grow" />
                <Button type="submit" size="sm" variant="primary" disabled={!parsed.title}>
                  Add
                </Button>
              </Row>
            )}
          </form>
        )}

        <Row gap={2}>
          {tag && (
            <Tag tone="aqua" icon={Hash}>
              {tag}
            </Tag>
          )}
          <span className="b-grow" />
          {view === "done" && counts.done > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => setTasks((ts) => ts.filter((t) => !t.done))}
            >
              Clear completed
            </Button>
          )}
        </Row>

        <div className={styles.list}>
          {visible.length === 0 ? (
            <EmptyState title={EMPTY_COPY[view].title} mood={view === "done" ? "sleepy" : "happy"}>
              {EMPTY_COPY[view].body}
            </EmptyState>
          ) : (
            groups.map(({ group, tasks: groupTasksList }) => (
              <section key={group}>
                {view !== "done" && (
                  <h3 className={cx(styles.groupTitle, group === "Overdue" && styles.overdue)}>
                    {group}
                  </h3>
                )}
                <ul className={styles.items}>
                  {groupTasksList.map((t) =>
                    editingId === t.id ? (
                      <TaskEditor
                        key={t.id}
                        task={t}
                        onSave={(patch) => {
                          update(t.id, patch);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => {
                          setTasks((ts) => ts.filter((x) => x.id !== t.id));
                          setEditingId(null);
                        }}
                      />
                    ) : (
                      <TaskRow
                        key={t.id}
                        task={t}
                        today={today}
                        onToggle={() =>
                          setTasks((ts) => ts.map((x) => (x.id === t.id ? toggleDone(x) : x)))
                        }
                        onEdit={() => setEditingId(t.id)}
                      />
                    ),
                  )}
                </ul>
              </section>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TaskRow({
  task,
  today,
  onToggle,
  onEdit,
}: { task: Task; today: string; onToggle: () => void; onEdit: () => void }) {
  const overdue = !task.done && task.due !== null && task.due < today;
  return (
    <li className={cx(styles.row, task.done && styles.done)}>
      <button
        type="button"
        aria-pressed={task.done}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        className={cx(styles.check, task.priority && styles[`check_${task.priority}`])}
        onClick={onToggle}
      >
        {task.done && <Check aria-hidden />}
      </button>
      <button type="button" className={styles.rowBody} onClick={onEdit} title="Edit">
        <span className={styles.title}>{task.title}</span>
        <span className={styles.meta}>
          {task.due && (
            <span className={cx(styles.due, overdue && styles.overdue)}>
              <CalendarDays aria-hidden />
              {dueLabel(task.due, today)}
            </span>
          )}
          {task.priority && (
            <span className={cx(styles.flag, styles[`flag_${task.priority}`])}>
              <Flag aria-hidden />
              {task.priority}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className={styles.tag}>
              #{t}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
] as const;

function TaskEditor({
  task,
  onSave,
  onCancel,
  onDelete,
}: {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.due ?? "");
  const [priority, setPriority] = useState<Priority | "none">(task.priority ?? "none");
  const [tags, setTags] = useState(task.tags.join(", "));

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      priority: priority === "none" ? null : priority,
      tags: tags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    });
  }

  return (
    <li>
      <form
        className={styles.editor}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault(); // keep Esc inside the editor instead of leaving the tool
            onCancel();
          }
        }}
      >
        <Input
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <Row gap={2} style={{ flexWrap: "wrap" }}>
          <Input
            type="date"
            aria-label="Due date"
            className={styles.dateInput}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <Segmented
            label="Priority"
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={setPriority}
          />
          <Input
            icon={Hash}
            aria-label="Tags"
            className={styles.tagsInput}
            placeholder="tags, comma separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </Row>
        <Row gap={2}>
          <IconButton icon={Trash2} label="Delete task" onClick={onDelete} />
          <span className="b-grow" />
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit">
            Save
          </Button>
        </Row>
      </form>
    </li>
  );
}
