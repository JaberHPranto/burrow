import { describe, expect, it } from "vitest";
import { parseBackup } from "./storage";

describe("parseBackup", () => {
  it("accepts a valid backup and drops unexpected keys", () => {
    const b = parseBackup(
      JSON.stringify({
        app: "burrow",
        version: 1,
        exportedAt: "2026-11-25T00:00:00Z",
        data: {
          "tasks.tasks": [1],
          "settings.all": { theme: "light" },
          "../evil": 1,
          nonamespace: 2,
        },
      }),
    );
    expect(Object.keys(b.data).sort()).toEqual(["settings.all", "tasks.tasks"]);
  });

  it("rejects other files", () => {
    expect(() => parseBackup('{"app":"other","version":1,"data":{}}')).toThrow(
      /Not a Burrow backup/,
    );
    expect(() => parseBackup('{"app":"burrow","version":2,"data":{}}')).toThrow(/newer version/);
    expect(() => parseBackup("[]")).toThrow();
    expect(() => parseBackup("not json")).toThrow();
  });
});
