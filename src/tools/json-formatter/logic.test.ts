import { describe, expect, it } from "vitest";
import { detectJson, formatJson, parseJson, sortKeysDeep, summarize } from "./logic";

describe("parseJson", () => {
  it("parses valid JSON", () => {
    expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("reports the line and column of an error", () => {
    const result = parseJson('{\n  "a": 1,\n  "b": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.line).toBe(3);
      expect(result.column).toBeGreaterThan(1);
      expect(result.message).not.toMatch(/position/);
    }
  });
});

describe("formatJson", () => {
  const value = { b: [1, { d: 1, c: 2 }], a: true };

  it("indents with spaces or tabs", () => {
    expect(formatJson(value, { indent: "2", minify: false, sortKeys: false })).toContain('\n  "b"');
    expect(formatJson(value, { indent: "tab", minify: false, sortKeys: false })).toContain(
      '\n\t"b"',
    );
  });

  it("minifies", () => {
    expect(formatJson(value, { indent: "2", minify: true, sortKeys: false })).toBe(
      '{"b":[1,{"d":1,"c":2}],"a":true}',
    );
  });

  it("sorts keys deeply", () => {
    expect(JSON.stringify(sortKeysDeep(value))).toBe('{"a":true,"b":[1,{"c":2,"d":1}]}');
  });
});

describe("summarize", () => {
  it("counts keys and depth", () => {
    expect(summarize({ a: { b: { c: 1 } }, d: [1, 2] })).toEqual({ keys: 4, depth: 3 });
  });
});

describe("detectJson", () => {
  it("suggests formatting for objects and arrays only", () => {
    expect(detectJson('{"a":1}')?.label).toBe("Format JSON");
    expect(detectJson("[1,2")?.label).toBe("Fix JSON");
    expect(detectJson("42")).toBeNull();
    expect(detectJson("hello")).toBeNull();
  });
});
