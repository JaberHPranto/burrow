import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings, resolveTheme } from "./settings";

describe("mergeSettings", () => {
  it("returns defaults for missing or junk data", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and drops wrong types", () => {
    const s = mergeSettings({
      theme: "light",
      hideOnBlur: "yes",
      clipboard: { maxItems: 500, ignoreSecrets: false, enabled: 1 },
      ai: { defaultProvider: "openai", providers: { openai: { model: "gpt-4o", baseUrl: 42 } } },
    });
    expect(s.theme).toBe("light");
    expect(s.hideOnBlur).toBe(true);
    expect(s.clipboard).toEqual({ enabled: true, maxItems: 500, ignoreSecrets: false });
    expect(s.ai.defaultProvider).toBe("openai");
    expect(s.ai.providers.openai).toEqual({ model: "gpt-4o", baseUrl: "" });
    expect(s.ai.providers.anthropic).toEqual({ model: "", baseUrl: "" });
  });

  it("rejects out-of-range numbers and unknown enums", () => {
    const s = mergeSettings({
      theme: "neon",
      clipboard: { maxItems: 5 },
      ai: { defaultProvider: "skynet" },
    });
    expect(s.theme).toBe("dark");
    expect(s.clipboard.maxItems).toBe(200);
    expect(s.ai.defaultProvider).toBe("anthropic");
  });

  it("does not share nested objects with the defaults", () => {
    const s = mergeSettings(undefined);
    s.clipboard.maxItems = 1;
    expect(DEFAULT_SETTINGS.clipboard.maxItems).toBe(200);
  });
});

describe("resolveTheme", () => {
  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
