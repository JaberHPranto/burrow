import { tools } from "@/tools";
import { describe, expect, it } from "vitest";
import { suggestForClipboard } from "../clipboard/suggest";
import { registry } from "./registry";

describe("tool catalogue", () => {
  it("has unique kebab-case ids", () => {
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("finds tools by name and keyword", () => {
    expect(registry.search("json")[0]?.id).toBe("json-formatter");
    expect(registry.search("eaddrinuse")[0]?.id).toBe("port-inspector");
    expect(registry.search("api key")[0]?.id).toBe("settings");
    expect(registry.search("clipboard history")[0]?.id).toBe("clipboard-history");
    expect(registry.search("emoji")[0]?.id).toBe("emoji-picker");
    expect(registry.search("summarize")[0]?.id).toBe("ai-summarize");
    expect(registry.search("grammar")[0]?.id).toBe("ai-grammar");
    expect(registry.search("translate")[0]?.id).toBe("ai-translate");
    expect(registry.search("slack")[0]?.id).toBe("ai-message");
    expect(registry.search("todo")[0]?.id).toBe("tasks");
    expect(registry.search("annotate")[0]?.id).toBe("screenshot");
    expect(registry.search("ocr")[0]?.id).toBe("ocr");
    expect(registry.search("eyedropper")[0]?.id).toBe("color-picker");
    expect(registry.search("openapi")[0]?.id).toBe("schema-mock");
  });
});

describe("clipboard suggestions", () => {
  const top = (text: string) => suggestForClipboard(text, tools)[0]?.tool.id;

  it("routes clipboard content to the right tool", () => {
    expect(top('{"name": "burrow"}')).toBe("json-formatter");
    expect(top("#88CCA6")).toBe("color-picker");
    expect(top('{"type":"object","properties":{"email":{"type":"string"}}}')).toBe("schema-mock");
    expect(top('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>')).toBe("svg-tools");
    expect(top("DATABASE_URL=postgres://x\nAPI_KEY=abc")).toBe("env-diff");
    expect(top("# Notes\n\n- one\n- two")).toBe("markdown-viewer");
    expect(top("আমি আজ অফিসে দেরি করে আসব, মিটিং পিছিয়ে দাও")).toBe("ai-translate");
    // Errors aren't routed to any AI tool.
    expect(top("TypeError: x is not a function\n    at render (src/App.tsx:12:5)")).toBeUndefined();
  });

  it("stays quiet for plain prose", () => {
    expect(suggestForClipboard("just some words I copied", tools)).toEqual([]);
    expect(suggestForClipboard("", tools)).toEqual([]);
  });

  it("survives a throwing detector", () => {
    const broken = {
      ...tools[0],
      detect: () => {
        throw new Error("boom");
      },
    } as (typeof tools)[number];
    expect(() => suggestForClipboard("{}", [broken])).not.toThrow();
  });
});
