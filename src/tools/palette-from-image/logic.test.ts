import { describe, expect, it } from "vitest";
import { exportPalette, extractPalette } from "./logic";

/** Build RGBA pixels: [color, count] pairs. */
function pixels(spec: Array<[[number, number, number, number], number]>): Uint8ClampedArray {
  const out: number[] = [];
  for (const [rgba, n] of spec) for (let i = 0; i < n; i++) out.push(...rgba);
  return new Uint8ClampedArray(out);
}

describe("extractPalette", () => {
  const img = pixels([
    [[136, 204, 166, 255], 600], // mint
    [[248, 225, 146, 255], 300], // butter
    [[24, 26, 32, 255], 100], // ink
    [[255, 0, 0, 0], 500], // transparent — ignored
  ]);

  it("finds the dominant colours ordered by share, ignoring transparency", () => {
    const palette = extractPalette(img, 3);
    expect(palette.map((c) => c.hex)).toEqual(["#88cca6", "#f8e192", "#181a20"]);
    expect(palette[0]?.share).toBeCloseTo(0.6, 5);
  });

  it("is deterministic", () => {
    expect(extractPalette(img, 3)).toEqual(extractPalette(img, 3));
  });

  it("handles empty input", () => {
    expect(extractPalette(new Uint8ClampedArray())).toEqual([]);
  });
});

describe("exportPalette", () => {
  const palette = extractPalette(
    pixels([
      [[255, 255, 255, 255], 10],
      [[0, 0, 0, 255], 5],
    ]),
    2,
  );

  it("orders dark → light and formats", () => {
    expect(exportPalette(palette, "hex")).toBe("#000000\n#ffffff");
    expect(exportPalette(palette, "css")).toContain("--palette-100: #000000;");
    expect(exportPalette(palette, "tailwind")).toContain('200: "#ffffff"');
  });
});
