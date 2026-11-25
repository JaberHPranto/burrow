import { describe, expect, it } from "vitest";
import {
  type ClipItem,
  addClip,
  clipKind,
  looksSecret,
  preview,
  searchClips,
  sortClips,
  trim,
} from "./history";

const opts = { maxItems: 3, ignoreSecrets: true };
const clip = (id: string, text: string, at: number, pinned = false): ClipItem => ({
  id,
  text,
  at,
  pinned,
  source: "extension",
});

describe("addClip", () => {
  it("adds newest first and moves duplicates to the top", () => {
    let items: ClipItem[] = [];
    items = addClip(items, "a", { ...opts, now: 1, id: "1" });
    items = addClip(items, "b", { ...opts, now: 2, id: "2" });
    items = addClip(items, "a", { ...opts, now: 3, id: "3" });
    expect(items.map((i) => [i.text, i.at, i.id])).toEqual([
      ["a", 3, "1"],
      ["b", 2, "2"],
    ]);
  });

  it("caps the list but keeps pinned items", () => {
    const items = [clip("p", "pinned", 0, true), clip("x", "x", 5), clip("y", "y", 4)];
    const next = addClip(items, "new", { ...opts, now: 9, id: "n" });
    expect(next.map((i) => i.id)).toEqual(["n", "p", "x"]);
  });

  it("skips empty text and secrets", () => {
    expect(addClip([], "   ", opts)).toEqual([]);
    expect(addClip([], "sk-ant-api03-abcdefghijklmnopqrstuvwxyz", opts)).toEqual([]);
    expect(
      addClip([], "sk-ant-api03-abcdefghijklmnopqrstuvwxyz", { ...opts, ignoreSecrets: false }),
    ).toHaveLength(1);
  });
});

describe("looksSecret", () => {
  it("catches common tokens, codes and keys", () => {
    for (const s of [
      "ghp_1234567890abcdefghijABCDEFGHIJ",
      "AKIAIOSFODNN7EXAMPLE",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
      "483920",
      "-----BEGIN OPENSSH PRIVATE KEY-----\nabc",
      "Xk9#mP2vL8qR4wT7nY1zB5cF",
    ]) {
      expect(looksSecret(s), s).toBe(true);
    }
  });

  it("leaves normal text alone", () => {
    for (const s of [
      "hello world",
      "npm run app:dev",
      "https://github.com/JaberHPranto/burrow/pull/12345678901",
      "useWindowSize",
      "2026",
      "ComponentDidMountWithProps",
    ]) {
      expect(looksSecret(s), s).toBe(false);
    }
  });
});

describe("helpers", () => {
  it("sorts pinned first then newest, and searches", () => {
    const items = [clip("a", "alpha", 1), clip("b", "beta", 3), clip("c", "gamma", 2, true)];
    expect(sortClips(items).map((i) => i.id)).toEqual(["c", "b", "a"]);
    expect(searchClips(items, "ET").map((i) => i.id)).toEqual(["b"]);
  });

  it("trims to size", () => {
    expect(trim([clip("a", "a", 1), clip("b", "b", 2)], 1).map((i) => i.id)).toEqual(["a"]);
  });

  it("classifies and previews", () => {
    expect(clipKind("https://burrow.dev")).toBe("url");
    expect(clipKind('{"a":1}')).toBe("json");
    expect(clipKind("#88cca6")).toBe("color");
    expect(clipKind("const x = 1;")).toBe("code");
    expect(clipKind("line one\nline two")).toBe("multiline");
    expect(preview("  a\n  b  ")).toBe("a b");
    expect(preview("x".repeat(200), 10)).toBe("xxxxxxxxx…");
  });
});
