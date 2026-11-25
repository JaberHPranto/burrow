import { describe, expect, it } from "vitest";
import { bezierPath, buildBezier, buildBoxShadow, buildGradient } from "./logic";

describe("buildBoxShadow", () => {
  it("formats layers and omits units on zero", () => {
    expect(
      buildBoxShadow([
        { x: 0, y: 4, blur: 12, spread: 0, color: "rgba(0,0,0,.2)", inset: false },
        { x: 2, y: 2, blur: 0, spread: 0, color: "#181a20", inset: true },
      ]),
    ).toBe("0 4px 12px 0 rgba(0,0,0,.2),\n    inset 2px 2px 0 0 #181a20");
  });

  it("returns none for no layers", () => {
    expect(buildBoxShadow([])).toBe("none");
  });
});

describe("buildGradient", () => {
  const stops = [
    { color: "#f8e192", position: 100 },
    { color: "#88cca6", position: 0 },
  ];

  it("sorts stops and supports every type", () => {
    expect(buildGradient({ type: "linear", angle: 135, stops })).toBe(
      "linear-gradient(135deg, #88cca6 0%, #f8e192 100%)",
    );
    expect(buildGradient({ type: "radial", angle: 0, stops })).toMatch(
      /^radial-gradient\(circle, /,
    );
    expect(buildGradient({ type: "conic", angle: 90, stops })).toMatch(
      /^conic-gradient\(from 90deg, /,
    );
  });
});

describe("bezier", () => {
  it("formats with two decimals", () => {
    expect(buildBezier([0.123, 0, 0.5555, 1])).toBe("cubic-bezier(0.12, 0, 0.56, 1)");
  });

  it("draws from bottom-left to top-right", () => {
    expect(bezierPath([0.25, 0.1, 0.25, 1], 120, 10)).toMatch(/^M 10 110 C .* 110 10$/);
  });
});
