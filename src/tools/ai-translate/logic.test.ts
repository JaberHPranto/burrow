import { describe, expect, it } from "vitest";
import { detectForeignScript, preset } from "./logic";

describe("translate preset", () => {
  it("names the target language in the prompt", () => {
    const p = preset.build("Hello", { to: "bn", style: "natural" });
    expect(p.system).toContain("into Bangla (Bengali)");
    expect(p.user).toContain("into Bangla (Bengali)");
    expect(p.system).toContain("Don't translate code");
  });

  it("defaults to English and a natural style", () => {
    const p = preset.build("Hola", { to: "klingon" });
    expect(p.system).toContain("into English");
    expect(p.system).toContain("native speaker");
    expect(preset.build("x", { style: "literal" }).system).toContain("original wording");
  });
});

describe("detectForeignScript", () => {
  it("suggests translating non-Latin text", () => {
    expect(detectForeignScript("আমি আজ অফিসে দেরি করে আসব, মিটিং পিছিয়ে দাও")?.label).toBe(
      "Translate this text",
    );
    expect(detectForeignScript("今日は会議がありますので、少し遅れます。")).not.toBeNull();
  });

  it("ignores English, short text and mostly-Latin mixes", () => {
    expect(detectForeignScript("Meeting moved to 3pm, see you there")).toBeNull();
    expect(detectForeignScript("হ্যাঁ")).toBeNull();
    expect(detectForeignScript("Deploy the build to staging tonight, ok? ধন্যবাদ")).toBeNull();
  });
});
