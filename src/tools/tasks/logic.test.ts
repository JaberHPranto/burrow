import { describe, expect, it } from "vitest";
import {
  type Task,
  addDays,
  createTask,
  cyclePriority,
  dueLabel,
  filterTasks,
  groupTasks,
  parseQuickAdd,
  toggleDone,
} from "./logic";

// 2026-11-25 is a Wednesday.
const TODAY = "2026-11-25";

describe("parseQuickAdd", () => {
  it("extracts priority, tags and due date", () => {
    expect(parseQuickAdd("Fix login bug !high #novara #Bug tomorrow", TODAY)).toEqual({
      title: "Fix login bug",
      priority: "high",
      due: "2026-11-26",
      tags: ["novara", "bug"],
    });
  });

  it("understands relative and named dates", () => {
    const due = (s: string) => parseQuickAdd(`task ${s}`, TODAY).due;
    expect(due("today")).toBe(TODAY);
    expect(due("fri")).toBe("2026-11-27");
    expect(due("monday")).toBe("2026-11-30");
    expect(due("wed")).toBe(TODAY); // same weekday = today
    expect(due("next week")).toBe("2026-12-02");
    expect(due("in 3 days")).toBe("2026-11-28");
    expect(due("in 2w")).toBe("2026-12-09");
    expect(due("2027-01-15")).toBe("2027-01-15");
    expect(due("dec 5")).toBe("2026-12-05");
    expect(due("5 jan")).toBe("2027-01-05"); // already passed this year → next year
  });

  it("supports shorthand priorities and leaves plain text alone", () => {
    expect(parseQuickAdd("Ship it !!!", TODAY).priority).toBe("high");
    expect(parseQuickAdd("Ship it !2", TODAY).priority).toBe("medium");
    expect(parseQuickAdd("Buy carrots", TODAY)).toEqual({
      title: "Buy carrots",
      priority: null,
      due: null,
      tags: [],
    });
    expect(parseQuickAdd("Email hello!", TODAY).title).toBe("Email hello!");
  });
});

const task = (over: Partial<Task>): Task => ({
  ...createTask(
    { title: over.title ?? "t", priority: null, due: null, tags: [] },
    0,
    over.id ?? "id",
  ),
  ...over,
});

describe("filtering and grouping", () => {
  const tasks = [
    task({ id: "overdue", due: addDays(TODAY, -2) }),
    task({ id: "today-low", due: TODAY, priority: "low" }),
    task({ id: "today-high", due: TODAY, priority: "high" }),
    task({ id: "later", due: addDays(TODAY, 30), tags: ["home"] }),
    task({ id: "nodate", tags: ["home"] }),
    task({ id: "done", done: true, completedAt: 5, due: TODAY }),
  ];

  it("builds smart lists", () => {
    expect(filterTasks(tasks, "today", TODAY, null).map((t) => t.id)).toEqual([
      "overdue",
      "today-high",
      "today-low",
    ]);
    expect(filterTasks(tasks, "upcoming", TODAY, null).map((t) => t.id)).toEqual(["later"]);
    expect(filterTasks(tasks, "all", TODAY, null)).toHaveLength(5);
    expect(filterTasks(tasks, "done", TODAY, null).map((t) => t.id)).toEqual(["done"]);
    expect(filterTasks(tasks, "all", TODAY, "home").map((t) => t.id)).toEqual(["later", "nodate"]);
  });

  it("groups sorted tasks", () => {
    const groups = groupTasks(filterTasks(tasks, "all", TODAY, null), TODAY);
    expect(groups.map((g) => g.group)).toEqual(["Overdue", "Today", "Later", "No date"]);
  });
});

describe("helpers", () => {
  it("labels due dates", () => {
    expect(dueLabel(TODAY, TODAY)).toBe("Today");
    expect(dueLabel("2026-11-26", TODAY)).toBe("Tomorrow");
    expect(dueLabel("2026-11-27", TODAY)).toBe("Fri");
    expect(dueLabel("2026-12-25", TODAY)).toBe("Dec 25");
    expect(dueLabel("2027-01-02", TODAY)).toBe("Jan 2, 2027");
  });

  it("toggles completion and cycles priority", () => {
    const t = task({});
    const done = toggleDone(t, 42);
    expect(done).toMatchObject({ done: true, completedAt: 42 });
    expect(toggleDone(done).done).toBe(false);
    expect([null, "low", "medium", "high"].map((p) => cyclePriority(p as never))).toEqual([
      "low",
      "medium",
      "high",
      null,
    ]);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
