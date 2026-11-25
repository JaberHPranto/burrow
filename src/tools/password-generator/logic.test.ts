import { describe, expect, it } from "vitest";
import { type PasswordOptions, estimateStrength, generatePassword, secureRandomInt } from "./logic";

const base: PasswordOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

describe("generatePassword", () => {
  it("has the requested length and one char from every set", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(base);
      expect(pw).toHaveLength(20);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/\d/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it("respects disabled sets and ambiguity filter", () => {
    const pw = generatePassword({
      ...base,
      symbols: false,
      upper: false,
      excludeAmbiguous: true,
      length: 200,
    });
    expect(pw).toMatch(/^[a-z2-9]+$/);
    expect(pw).not.toMatch(/[01lO]/);
  });

  it("returns empty when nothing is enabled", () => {
    expect(
      generatePassword({ ...base, lower: false, upper: false, digits: false, symbols: false }),
    ).toBe("");
  });
});

describe("secureRandomInt", () => {
  it("stays in range", () => {
    for (let i = 0; i < 1000; i++) {
      const n = secureRandomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});

describe("estimateStrength", () => {
  it("grows with length and pool size", () => {
    expect(estimateStrength({ ...base, length: 6, upper: false, symbols: false }).label).toBe(
      "weak",
    );
    expect(estimateStrength({ ...base, length: 14 }).label).toBe("strong");
    expect(estimateStrength({ ...base, length: 32 }).label).toBe("excellent");
  });
});
