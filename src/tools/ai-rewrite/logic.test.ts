import { describe, expect, it } from "vitest";
import { preset } from "./logic";

describe("rewrite preset", () => {
  it("applies each tone", () => {
    expect(preset.build("x", { tone: "shorter" }).system).toContain("half as long");
    expect(preset.build("x", { tone: "formal" }).system).toContain("more formal");
    expect(preset.build("x", { tone: "casual" }).system).toContain("conversational");
  });

  it("defaults to clearer and keeps the language", () => {
    const p = preset.build("Bonjour", { tone: "??" });
    expect(p.system).toContain("clearer");
    expect(p.system).toContain("original language");
  });
});
