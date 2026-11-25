import { describe, expect, it } from "vitest";
import { createRng, generate, person } from "./logic";

describe("fake data", () => {
  it("is reproducible for a seed", () => {
    expect(generate("paragraphs", 2, createRng(42))).toBe(generate("paragraphs", 2, createRng(42)));
    expect(generate("names", 3, createRng(1))).not.toBe(generate("names", 3, createRng(2)));
  });

  it("produces the requested count", () => {
    expect(generate("words", 12, createRng(1)).split(" ")).toHaveLength(12);
    expect(generate("uuids", 5, createRng(1)).split("\n")).toHaveLength(5);
    expect(JSON.parse(generate("people", 4, createRng(1)))).toHaveLength(4);
  });

  it("makes valid-looking records", () => {
    const p = person(createRng(7));
    expect(p.email).toMatch(/^[a-z.]+\d+@[a-z.]+$/);
    expect(p.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Number.isNaN(Date.parse(p.createdAt))).toBe(false);
  });

  it("clamps the count", () => {
    expect(generate("names", 9999, createRng(1)).split("\n")).toHaveLength(500);
  });
});
