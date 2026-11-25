import { describe, expect, it } from "vitest";
import { MAX_HISTORY, detectColor, pushHistory } from "./logic";

describe("colour history", () => {
  it("puts the newest first without duplicates", () => {
    const h = pushHistory(["#ffffff", "#88cca6"], { r: 136, g: 204, b: 166 });
    expect(h).toEqual(["#88cca6", "#ffffff"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`);
    expect(pushHistory(many, { r: 1, g: 2, b: 3 })).toHaveLength(MAX_HISTORY);
  });
});

describe("detectColor", () => {
  it("suggests converting colour values", () => {
    expect(detectColor("#181A20")?.label).toBe("Convert colour");
    expect(detectColor("hsl(146 40% 67%)")).not.toBeNull();
    expect(detectColor("not a colour")).toBeNull();
  });
});
