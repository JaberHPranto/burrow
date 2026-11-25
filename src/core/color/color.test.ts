import { describe, expect, it } from "vitest";
import {
  colorFormats,
  contrastRatio,
  looksLikeColor,
  parseColor,
  readableOn,
  rgbToHsl,
  rgbToOklch,
  toHex,
} from "./color";

describe("parseColor", () => {
  it("parses hex forms", () => {
    expect(parseColor("#88CCA6")).toEqual({ r: 136, g: 204, b: 166 });
    expect(parseColor("fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#00000080")?.a).toBeCloseTo(0.5, 2);
  });

  it("parses rgb() and hsl()", () => {
    expect(parseColor("rgb(24, 26, 32)")).toEqual({ r: 24, g: 26, b: 32 });
    expect(parseColor("rgba(255 0 0 / 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(toHex(parseColor("hsl(0, 100%, 50%)") ?? { r: 0, g: 0, b: 0 })).toBe("#ff0000");
  });

  it("rejects junk", () => {
    expect(parseColor("#12")).toBeNull();
    expect(parseColor("rgb(1,2)")).toBeNull();
    expect(parseColor("banana")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
    // #767676 on white is the classic 4.54:1
    expect(contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, white)).toBeCloseTo(4.54, 2);
  });
});

describe("helpers", () => {
  it("converts to HSL", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, l: 0.5 });
  });

  it("detects colour-looking clipboard text", () => {
    expect(looksLikeColor("#88cca6")).toBe(true);
    expect(looksLikeColor("rgb(1, 2, 3)")).toBe(true);
    expect(looksLikeColor("fff")).toBe(false); // too ambiguous without a #
    expect(looksLikeColor("some text")).toBe(false);
  });
});

describe("oklch & formats", () => {
  it("matches reference OKLCH values", () => {
    const red = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(white.l).toBeCloseTo(1, 3);
    expect(white.c).toBeCloseTo(0, 3);
  });

  it("formats every notation", () => {
    expect(colorFormats({ r: 136, g: 204, b: 166 })).toEqual({
      hex: "#88cca6",
      rgb: "rgb(136 204 166)",
      hsl: "hsl(146 40% 67%)",
      oklch: expect.stringMatching(/^oklch\(\d+\.\d% 0\.\d{3} \d+\.\d\)$/),
    });
  });

  it("picks readable text colours", () => {
    expect(readableOn({ r: 248, g: 225, b: 146 })).toBe("#181a20");
    expect(readableOn({ r: 24, g: 26, b: 32 })).toBe("#ffffff");
  });
});
