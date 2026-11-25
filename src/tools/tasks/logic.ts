/**
 * Personal task manager model. Dates are local calendar days as "YYYY-MM-DD"
 * strings, which avoids timezone drift when tasks are stored and reloaded.
 */

export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority | null;
  /** Local date "YYYY-MM-DD" or null. */
  due: string | null;
  tags: string[];
  createdAt: number;
  completedAt?: number;
}

/* ---------------- Dates ---------------- */

export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return toDay(new Date(y, m - 1, d + n));
}

function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).getDay();
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/* ---------------- Quick add ---------------- */

export interface QuickAdd {
  title: string;
  priority: Priority | null;
  due: string | null;
  tags: string[];
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  "!high": "high",
  "!h": "high",
  "!1": "high",
  "!!!": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!2": "medium",
  "!!": "medium",
  "!low": "low",
  "!l": "low",
  "!3": "low",
};

/**
 * Parse "Fix login bug !high #novara tomorrow" into structured fields.
 * Recognised anywhere in the text (tokens are removed from the title):
 *   priority  !high !med !low  (or !1 !2 !3, !!!, !!)
 *   tags      #word
 *   due       today, tod, tomorrow, tmr, mon…sun / monday…, next week,
 *             in 3 days / in 3d, 2026-12-01, dec 5 / 5 dec
 */
export function parseQuickAdd(input: string, today: string): QuickAdd {
  let text = ` ${input.trim()} `;
  let priority: Priority | null = null;
  let due: string | null = null;
  const tags: string[] = [];

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean) => {
    const m = re.exec(text);
    if (m && fn(m)) text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
  };

  // tags (all of them)
  text = text.replace(/\s#([\p{L}\p{N}_-]+)/gu, (_, tag: string) => {
    if (!tags.includes(tag.toLowerCase())) tags.push(tag.toLowerCase());
    return " ";
  });

  // priority
  take(/\s(!high|!medium|!med|!low|!h|!m|!l|![123]|!!!|!!)(?=\s)/i, (m) => {
    priority = PRIORITY_TOKENS[(m[1] as string).toLowerCase()] ?? null;
    return priority !== null;
  });

  // due — first match wins
  const dueRules: Array<[RegExp, (m: RegExpExecArray) => string | null]> = [
    [/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
    [/\s(today|tod)(?=\s)/i, () => today],
    [/\s(tomorrow|tmr|tmrw)(?=\s)/i, () => addDays(today, 1)],
    [/\snext week(?=\s)/i, () => addDays(today, 7)],
    [/\sin (\d{1,3}) ?(d|days?)(?=\s)/i, (m) => addDays(today, Number(m[1]))],
    [/\sin (\d{1,2}) ?(w|weeks?)(?=\s)/i, (m) => addDays(today, Number(m[1]) * 7)],
    [
      /\s(sun|mon|tue|wed|thu|fri|sat)[a-z]*(?=\s)/i,
      (m) => {
        const target = WEEKDAYS.indexOf((m[1] as string).toLowerCase());
        const delta = (target - weekday(today) + 7) % 7;
        return addDays(today, delta);
      },
    ],
    [
      /\s(\d{1,2}) (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?=\s)/i,
      (m) => monthDay(today, m[2] as string, Number(m[1])),
    ],
    [
      /\s(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\d{1,2})(?=\s)/i,
      (m) => monthDay(today, m[1] as string, Number(m[2])),
    ],
  ];
  for (const [re, toDate] of dueRules) {
    let matched = false;
    take(re, (m) => {
      due = toDate(m);
      matched = due !== null;
      return matched;
    });
    if (matched) break;
  }

  return { title: text.replace(/\s+/g, " ").trim(), priority, due, tags };
}

/** "dec 5" → this year's date, or next year's if it has already passed. */
function monthDay(today: string, month: string, day: number): string | null {
  const mi = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
  if (mi < 0 || day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  const candidate = toDay(new Date(year, mi, day));
  return candidate < today ? toDay(new Date(year + 1, mi, day)) : candidate;
}

/* ---------------- Lists & sorting ---------------- */

export type View = "today" | "upcoming" | "all" | "done";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };

export function compareTasks(a: Task, b: Task): number {
  return (
    (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
    (PRIORITY_RANK[a.priority ?? "none"] as number) -
      (PRIORITY_RANK[b.priority ?? "none"] as number) ||
    a.createdAt - b.createdAt
  );
}

export function filterTasks(
  tasks: readonly Task[],
  view: View,
  today: string,
  tag: string | null,
): Task[] {
  const byTag = tag ? tasks.filter((t) => t.tags.includes(tag)) : [...tasks];
  switch (view) {
    case "today":
      return byTag.filter((t) => !t.done && t.due !== null && t.due <= today).sort(compareTasks);
    case "upcoming":
      return byTag.filter((t) => !t.done && t.due !== null && t.due > today).sort(compareTasks);
    case "all":
      return byTag.filter((t) => !t.done).sort(compareTasks);
    case "done":
      return byTag
        .filter((t) => t.done)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  }
}

export type Group =
  | "Overdue"
  | "Today"
  | "Tomorrow"
  | "This week"
  | "Later"
  | "No date"
  | "Completed";

export function groupOf(task: Task, today: string): Group {
  if (task.done) return "Completed";
  if (!task.due) return "No date";
  if (task.due < today) return "Overdue";
  if (task.due === today) return "Today";
  if (task.due === addDays(today, 1)) return "Tomorrow";
  if (task.due <= addDays(today, 7)) return "This week";
  return "Later";
}

/** Group an already-sorted list, keeping order. */
export function groupTasks(
  tasks: readonly Task[],
  today: string,
): Array<{ group: Group; tasks: Task[] }> {
  const out: Array<{ group: Group; tasks: Task[] }> = [];
  for (const task of tasks) {
    const group = groupOf(task, today);
    const last = out.at(-1);
    if (last?.group === group) last.tasks.push(task);
    else out.push({ group, tasks: [task] });
  }
  return out;
}

export function countByView(tasks: readonly Task[], today: string): Record<View, number> {
  return {
    today: filterTasks(tasks, "today", today, null).length,
    upcoming: filterTasks(tasks, "upcoming", today, null).length,
    all: filterTasks(tasks, "all", today, null).length,
    done: filterTasks(tasks, "done", today, null).length,
  };
}

export function allTags(tasks: readonly Task[]): string[] {
  return [...new Set(tasks.filter((t) => !t.done).flatMap((t) => t.tags))].sort();
}

/** "Today", "Tomorrow", "Fri", "Dec 12" — short label for a due date. */
export function dueLabel(due: string, today: string): string {
  if (due === today) return "Today";
  if (due === addDays(today, 1)) return "Tomorrow";
  if (due === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  if (due > today && due <= addDays(today, 6))
    return date.toLocaleDateString("en", { weekday: "short" });
  const sameYear = y === Number(today.slice(0, 4));
  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function createTask(
  fields: QuickAdd,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): Task {
  return {
    id,
    title: fields.title,
    done: false,
    priority: fields.priority,
    due: fields.due,
    tags: fields.tags,
    createdAt: now,
  };
}

export function toggleDone(task: Task, now = Date.now()): Task {
  return task.done
    ? { ...task, done: false, completedAt: undefined }
    : { ...task, done: true, completedAt: now };
}

export function cyclePriority(p: Priority | null): Priority | null {
  const order: Array<Priority | null> = [null, "low", "medium", "high"];
  return order[(order.indexOf(p) + 1) % order.length] ?? null;
}
