import { describe, expect, it } from "vitest";
import type { Requirement } from "./catalog";
import { reportFor } from "./logic";

const ocr: Requirement[] = [
  { id: "gnome-screenshot", level: "recommended", why: "no dialog" },
  { id: "tesseract", level: "required", why: "reads text" },
  { id: "tesseract-ben", level: "optional", why: "Bangla" },
];

describe("reportFor", () => {
  it("lists missing packages, worst first, with one install command", () => {
    const r = reportFor(ocr, {
      "gnome-screenshot": false,
      tesseract: false,
      "tesseract-ben": false,
    });
    expect(r.level).toBe("required");
    expect(r.missing.map((m) => m.id)).toEqual(["tesseract", "gnome-screenshot"]);
    expect(r.extras.map((m) => m.id)).toEqual(["tesseract-ben"]);
    expect(r.installCommand).toBe(
      "sudo apt install gnome-screenshot tesseract-ocr tesseract-ocr-eng tesseract-ocr-ben",
    );
  });

  it("reports only recommended when required ones are present", () => {
    const r = reportFor(ocr, { "gnome-screenshot": false, tesseract: true, "tesseract-ben": true });
    expect(r.level).toBe("recommended");
    expect(r.installCommand).toBe("sudo apt install gnome-screenshot");
  });

  it("optional-only gaps don't raise a badge", () => {
    const r = reportFor(ocr, { "gnome-screenshot": true, tesseract: true, "tesseract-ben": false });
    expect(r.level).toBeNull();
    expect(r.extras).toHaveLength(1);
  });

  it("never alarms when status is unknown or a tool has no requirements", () => {
    expect(reportFor(ocr, null).level).toBeNull();
    expect(reportFor(ocr, {}).missing).toEqual([]);
    expect(reportFor(undefined, { tesseract: false }).installCommand).toBe("");
  });
});
