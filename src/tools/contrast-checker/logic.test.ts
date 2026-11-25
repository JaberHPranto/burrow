import { describe, expect, it } from "vitest";
import { checkContrast, detectColor, formatRatio } from "./logic";

const white = { r: 255, g: 255, b: 255 };

describe("checkContrast", () => {
  it("applies WCAG thresholds", () => {
    const grey = checkContrast({ r: 0x76, g: 0x76, b: 0x76 }, white); // 4.54
    expect(grey).toMatchObject({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
    const pale = checkContrast({ r: 0xaa, g: 0xaa, b: 0xaa }, white); // ~2.32
    expect(pale).toMatchObject({ aaNormal: false, aaLarge: false });
  });
});

describe("formatRatio", () => {
  it("truncates instead of rounding up to a passing value", () => {
    expect(formatRatio(4.499)).toBe("4.49:1");
    expect(formatRatio(21)).toBe("21.00:1");
  });
});

describe("detectColor", () => {
  it("suggests the tool for colour values", () => {
    expect(detectColor("#181A20")?.label).toBe("Check contrast");
    expect(detectColor("hello")).toBeNull();
  });
});
