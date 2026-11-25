import { describe, expect, it } from "vitest";
import { optimizeSvg } from "./optimize";

describe("optimizeSvg", () => {
  it("shrinks markup and keeps the viewBox", () => {
    const svg = `<?xml version="1.0"?>\n<!-- comment -->\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">\n  <g>\n    <path d="M 0 0 L 24 24" fill="#000000"/>\n  </g>\n</svg>`;
    const result = optimizeSvg(svg);
    expect(result.after).toBeLessThan(result.before);
    expect(result.data).toContain('viewBox="0 0 24 24"');
    expect(result.data).not.toContain("<!--");
  });
});
