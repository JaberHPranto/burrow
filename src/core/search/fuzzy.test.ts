import { describe, expect, it } from "vitest";
import { fuzzyScore, scoreFields } from "./fuzzy";

describe("fuzzyScore", () => {
  it("ranks exact > prefix > word prefix > substring > subsequence", () => {
    const exact = fuzzyScore("json", "json");
    const prefix = fuzzyScore("json", "json formatter");
    const word = fuzzyScore("form", "json formatter");
    const sub = fuzzyScore("rmat", "json formatter");
    const seq = fuzzyScore("jsf", "json formatter");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(seq);
    expect(seq).toBeGreaterThan(0);
  });

  it("returns 0 when characters are missing or out of order", () => {
    expect(fuzzyScore("xyz", "json formatter")).toBe(0);
    expect(fuzzyScore("nosj", "json")).toBe(0);
  });

  it("matches everything for an empty query", () => {
    expect(fuzzyScore("  ", "anything")).toBe(1);
  });
});

describe("scoreFields", () => {
  it("prefers a name match over an equal keyword match", () => {
    expect(scoreFields("port", ["Port inspector"])).toBeGreaterThan(
      scoreFields("port", ["Network tool", "port inspector"]),
    );
  });
});
