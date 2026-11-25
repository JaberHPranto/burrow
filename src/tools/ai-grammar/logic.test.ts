import { describe, expect, it } from "vitest";
import { preset } from "./logic";

describe("grammar preset", () => {
  it("asks for corrections only and keeps formatting", () => {
    const p = preset.build("i has a apple", { mode: "fix" });
    expect(p.user).toContain("<text>\ni has a apple\n</text>");
    expect(p.system).toContain("Change only what is wrong");
    expect(p.system).toContain("Never translate");
    expect(p.system).toContain("Return only the corrected text");
  });

  it("polishes when asked", () => {
    expect(preset.build("x", { mode: "polish" }).system).toContain("smooth awkward");
  });

  it("returns plain text you can paste back", () => {
    expect(preset.output).toBe("text");
    expect(preset.reusable).toBe(true);
  });
});
