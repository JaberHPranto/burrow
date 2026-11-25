import { describe, expect, it } from "vitest";
import { detectMarkdown, documentStats } from "./logic";

describe("documentStats", () => {
  it("counts prose words and skips code", () => {
    const md =
      "# Title here\n\nSome **bold** words and a [link](https://x.y).\n\n```js\nconst notCounted = 1;\n```";
    expect(documentStats(md).words).toBe(8);
    expect(documentStats(md).minutes).toBe(1);
  });
});

describe("detectMarkdown", () => {
  it("needs two signals", () => {
    expect(detectMarkdown("# Title\n\n- one\n- two")).not.toBeNull();
    expect(detectMarkdown("# just a hash\nplain")).toBeNull();
    expect(detectMarkdown("single line **bold** [a](b)")).toBeNull();
  });
});
