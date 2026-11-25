import { describe, expect, it } from "vitest";
import { detectError, preset } from "./logic";

describe("explain preset", () => {
  it("switches between error, code and auto", () => {
    expect(preset.build("x", { focus: "error", depth: "quick" }).system).toContain(
      "most likely cause",
    );
    expect(preset.build("x", { focus: "code", depth: "quick" }).system).toContain("what it does");
    expect(preset.build("x", {}).system).toContain("Work out whether");
    expect(preset.build("x", { depth: "thorough" }).system).toContain("headings");
  });
});

describe("detectError", () => {
  it.each([
    ['Traceback (most recent call last):\n  File "a.py", line 1\nValueError: bad', 0.85],
    ["thread 'main' panicked at src/main.rs:4:5:\nboom", 0.85],
    ["TypeError: x is not a function\n    at render (src/App.tsx:12:5)", 0.8],
    ["java.lang.NullPointerException\n\tat com.acme.App.main(App.java:14)", 0.8],
    ["error[E0382]: borrow of moved value: `v`", 0.75],
    ["Uncaught ReferenceError: foo is not defined", 0.7],
    ["npm ERR! code ERESOLVE", 0.65],
    ["fatal: not a git repository (or any of the parent directories): .git", 0.65],
    ["bash: kubeclt: command not found", 0.65],
  ])("recognises %s", (text, score) => {
    expect(detectError(text)).toEqual({ score, label: "Explain this error" });
  });

  it("ignores ordinary text and code", () => {
    expect(detectError("The error budget for Q3 is fine.")).toBeNull();
    expect(detectError("const error = new Error('x');")).toBeNull();
    expect(detectError('{"error": null}')).toBeNull();
  });
});
