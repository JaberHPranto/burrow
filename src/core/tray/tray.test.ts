import { MAX_TRAY_ITEMS, mergeSettings } from "@/core/settings/settings";
import type { ToolDefinition } from "@/core/tools/types";
import { describe, expect, it } from "vitest";
import { toggleTray, trayCandidates, trayItems } from "./tray";

const tool = (id: string, name: string, tray?: ToolDefinition["tray"]) =>
  ({ id, name, tray }) as unknown as ToolDefinition;

const tools = [
  tool("screenshot", "Screenshot", { label: "Take screenshot", run: true }),
  tool("tasks", "Tasks"),
  tool("emoji-picker", "Emoji picker"),
  tool("settings", "Settings"),
];

describe("trayItems", () => {
  it("uses catalogue order, tray labels and the run flag", () => {
    expect(trayItems(["tasks", "screenshot"], tools)).toEqual([
      { id: "screenshot", label: "Take screenshot", run: true },
      { id: "tasks", label: "Tasks", run: false },
    ]);
  });

  it("skips unknown tools and the fixed Settings entry", () => {
    expect(trayItems(["gone", "settings", "tasks"], tools).map((i) => i.id)).toEqual(["tasks"]);
    expect(trayCandidates(tools).map((t) => t.id)).not.toContain("settings");
  });

  it("allows an empty tray", () => {
    expect(trayItems([], tools)).toEqual([]);
  });
});

describe("toggleTray", () => {
  it("adds and removes without duplicates", () => {
    expect(toggleTray(["tasks"], "screenshot", true)).toEqual(["tasks", "screenshot"]);
    expect(toggleTray(["tasks", "screenshot"], "tasks", true)).toEqual(["screenshot", "tasks"]);
    expect(toggleTray(["tasks", "screenshot"], "tasks", false)).toEqual(["screenshot"]);
  });

  it("stops at the limit", () => {
    const full = Array.from({ length: MAX_TRAY_ITEMS }, (_, i) => `t${i}`);
    expect(toggleTray(full, "extra", true)).toEqual(full);
  });
});

describe("tray setting", () => {
  it("defaults to the classic quick tools and cleans stored values", () => {
    expect(mergeSettings({}).tray).toContain("screenshot");
    expect(mergeSettings({ tray: ["tasks", "tasks", "Bad Id", 3, "ocr"] }).tray).toEqual([
      "tasks",
      "ocr",
    ]);
    expect(mergeSettings({ tray: [] }).tray).toEqual([]);
    expect(mergeSettings({ tray: "tasks" }).tray).toContain("screenshot");
  });
});
