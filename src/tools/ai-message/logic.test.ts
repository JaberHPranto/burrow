import { normaliseOptions } from "@/core/ai/ai";
import { describe, expect, it } from "vitest";
import { messagePrompt, preset } from "./logic";

const defaults = normaliseOptions(preset, undefined);

describe("message preset", () => {
  it("defaults to a short, friendly Slack message in English without emoji", () => {
    expect(defaults).toEqual({
      where: "slack",
      tone: "friendly",
      length: "short",
      emoji: "none",
      language: "en",
    });
    const { system } = messagePrompt("deploy moved to friday", defaults);
    expect(system).toContain("Slack channel");
    expect(system).toContain("warm and friendly");
    expect(system).toContain("one to three sentences");
    expect(system).toContain("Don't use emoji");
    expect(system).toContain("Write in English");
  });

  it("adapts to WhatsApp, DMs and the chosen language", () => {
    expect(messagePrompt("x", { ...defaults, where: "whatsapp" }).system).toContain(
      "WhatsApp team group",
    );
    expect(messagePrompt("x", { ...defaults, where: "dm" }).system).toContain(
      "direct message to one person",
    );
    expect(messagePrompt("x", { ...defaults, language: "banglish" }).system).toContain(
      "Bangla typed in English letters",
    );
    expect(messagePrompt("x", { ...defaults, language: "bn" }).system).toContain("Bengali script");
    expect(messagePrompt("x", { ...defaults, emoji: "few" }).system).toContain(
      "one or two fitting emoji",
    );
  });

  it("keeps it human and faithful to the notes", () => {
    const { system, user } = messagePrompt("ask @rafi to check logs", defaults);
    expect(system).toContain("no em dashes");
    expect(system).toContain("don't invent facts");
    expect(system).toContain("Reply with the message only");
    expect(user).toContain("<text>\nask @rafi to check logs\n</text>");
  });

  it("falls back to defaults for unknown option values", () => {
    const { system } = messagePrompt("x", {
      where: "teams",
      tone: "?",
      length: "?",
      emoji: "?",
      language: "?",
    });
    expect(system).toContain("Slack channel");
    expect(system).toContain("Write in English");
  });

  it("starts from your notes, not the clipboard", () => {
    expect(preset.prefillFromClipboard).toBe(false);
    expect(preset.output).toBe("text");
  });
});
