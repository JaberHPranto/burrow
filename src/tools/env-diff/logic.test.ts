import { describe, expect, it } from "vitest";
import { buildExample, detectEnv, diffEnv, maskValue, parseEnv } from "./logic";

describe("parseEnv", () => {
  it("handles comments, export, quotes and inline comments", () => {
    const env = parseEnv(`
# database
export DB_URL="postgres://u:p@h/db # not a comment"
API_KEY=abc123 # trailing comment
EMPTY=
SINGLE='x y'
not a valid line
`);
    expect(Object.fromEntries(env)).toEqual({
      DB_URL: "postgres://u:p@h/db # not a comment",
      API_KEY: "abc123",
      EMPTY: "",
      SINGLE: "x y",
    });
  });
});

describe("diffEnv", () => {
  it("classifies keys", () => {
    const env = parseEnv("A=1\nB=\nEXTRA=1");
    const example = parseEnv("A=\nB=\nC=");
    expect(diffEnv(env, example)).toEqual({
      missing: ["C"],
      extra: ["EXTRA"],
      empty: ["B"],
      ok: ["A"],
    });
  });
});

describe("helpers", () => {
  it("masks secrets", () => {
    expect(maskValue("")).toBe("(empty)");
    expect(maskValue("abc")).toBe("••••");
    expect(maskValue("sk_live_123")).toBe("sk•••••••••");
  });

  it("builds a merged example without leaking values", () => {
    const out = buildExample(parseEnv("A=secret\nNEW=x"), parseEnv("A=\nB=default"));
    expect(out).toBe("A=\nB=default\nNEW=\n");
  });

  it("detects env-looking text", () => {
    expect(detectEnv("A=1\nB=2\n# c")).not.toBeNull();
    expect(detectEnv("hello\nworld")).toBeNull();
  });
});
