import { describe, expect, it } from "vitest";
import { type KeyLike, acceleratorParts, reservedReason, toAccelerator } from "./accelerator";

const ev = (over: Partial<KeyLike>): KeyLike => ({
  key: "",
  code: "",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...over,
});

describe("toAccelerator", () => {
  it("builds GNOME accelerators in a stable modifier order", () => {
    expect(toAccelerator(ev({ key: " ", code: "Space", ctrlKey: true, altKey: true }))).toEqual({
      ok: true,
      accelerator: "<Control><Alt>space",
    });
    expect(toAccelerator(ev({ key: "S", code: "KeyS", shiftKey: true, metaKey: true }))).toEqual({
      ok: true,
      accelerator: "<Shift><Super>s",
    });
  });

  it("uses the physical key so layouts don't matter", () => {
    // e.g. a Bangla layout produces a different `key` for the S key
    expect(toAccelerator(ev({ key: "স", code: "KeyS", ctrlKey: true }))).toEqual({
      ok: true,
      accelerator: "<Control>s",
    });
  });

  it("allows function keys and Print alone, rejects bare letters", () => {
    expect(toAccelerator(ev({ key: "F9", code: "F9" }))).toEqual({ ok: true, accelerator: "F9" });
    expect(toAccelerator(ev({ key: "a", code: "KeyA" }))).toEqual({
      ok: false,
      reason: "needs-modifier",
    });
    expect(toAccelerator(ev({ key: "Control", code: "ControlLeft", ctrlKey: true }))).toEqual({
      ok: false,
      reason: "modifier-only",
    });
    expect(toAccelerator(ev({ key: "Unidentified", code: "IntlRo", ctrlKey: true }))).toEqual({
      ok: false,
      reason: "unsupported-key",
    });
  });
});

describe("labels and reserved shortcuts", () => {
  it("renders readable key caps", () => {
    expect(acceleratorParts("<Control><Alt>space")).toEqual(["Ctrl", "Alt", "Space"]);
    expect(acceleratorParts("<Super>comma")).toEqual(["Super", ","]);
    expect(acceleratorParts("F9")).toEqual(["F9"]);
  });

  it("warns about GNOME's own shortcuts", () => {
    expect(reservedReason("<Control><Alt>t")).toBe("opens Terminal");
    expect(reservedReason("<Control><Alt>s")).toBeNull();
  });
});
