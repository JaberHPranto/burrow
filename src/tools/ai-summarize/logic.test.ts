import { describe, expect, it } from "vitest";
import { detectLongProse, preset } from "./logic";

const article = Array.from(
  { length: 12 },
  (_, i) =>
    `Paragraph ${i} explains how the burrow keeps rabbits warm in winter and safe from foxes.`,
).join(" ");

describe("summarize preset", () => {
  it("wraps the text and follows the chosen length", () => {
    const one = preset.build("Hello world.", { length: "tldr" });
    expect(one.user).toContain("<text>\nHello world.\n</text>");
    expect(one.system).toContain("single sentence");
    expect(preset.build("x", { length: "detailed" }).system).toContain("overview paragraph");
  });

  it("falls back to key points for an unknown length", () => {
    expect(preset.build("x", { length: "epic" }).system).toContain("bullet points");
  });
});

describe("detectLongProse", () => {
  it("suggests summarising long prose", () => {
    expect(detectLongProse(article)?.label).toBe("Summarise this text");
  });

  it("ignores short text, JSON and code", () => {
    expect(detectLongProse("Too short. Really.")).toBeNull();
    expect(detectLongProse(`{"a": "${article}"}`)).toBeNull();
    const code = Array.from({ length: 40 }, (_, i) => `const x${i} = { a: ${i} }; // ok.`).join(
      "\n",
    );
    expect(detectLongProse(code)).toBeNull();
  });
});
