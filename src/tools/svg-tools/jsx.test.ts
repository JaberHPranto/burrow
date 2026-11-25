import { describe, expect, it } from "vitest";
import {
  detectSvg,
  jsxAttributeName,
  styleToObject,
  svgToComponent,
  svgToJsxMarkup,
  toComponentName,
} from "./jsx";

describe("jsxAttributeName", () => {
  it("renames special and kebab-case attributes", () => {
    expect(jsxAttributeName("class")).toBe("className");
    expect(jsxAttributeName("stroke-width")).toBe("strokeWidth");
    expect(jsxAttributeName("xlink:href")).toBe("xlinkHref");
    expect(jsxAttributeName("aria-hidden")).toBe("aria-hidden");
    expect(jsxAttributeName("data-id")).toBe("data-id");
    expect(jsxAttributeName("viewBox")).toBe("viewBox");
  });
});

describe("styleToObject", () => {
  it("converts declarations, keeps custom properties quoted", () => {
    expect(styleToObject("fill: red; stroke-width:2; --x: url(a:b)")).toBe(
      '{{ fill: "red", strokeWidth: "2", "--x": "url(a:b)" }}',
    );
  });
});

describe("svgToJsxMarkup", () => {
  const svg = `<?xml version="1.0"?><!-- icon --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="i"><g fill-rule="evenodd"><path d="M0 0h24" stroke-linecap="round"/></g><text style="font-size:4px">Hi</text></svg>`;

  it("converts and indents, spreading props on the root only", () => {
    expect(svgToJsxMarkup(svg)).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="i" {...props}>',
        '  <g fillRule="evenodd">',
        '    <path d="M0 0h24" strokeLinecap="round" />',
        "  </g>",
        '  <text style={{ fontSize: "4px" }}>',
        '    {"Hi"}',
        "  </text>",
        "</svg>",
      ].join("\n"),
    );
  });

  it("wraps in a typed component", () => {
    const out = svgToComponent(svg, { name: "arrow-right.svg", typescript: true });
    expect(out).toContain('import type { SVGProps } from "react";');
    expect(out).toContain("export function ArrowRight(props: SVGProps<SVGSVGElement>) {");
    expect(svgToComponent(svg, { name: "x", typescript: false })).toContain(
      "export function X(props) {",
    );
  });
});

describe("helpers", () => {
  it("makes safe component names", () => {
    expect(toComponentName("my icon")).toBe("MyIcon");
    expect(toComponentName("24-px")).toBe("Svg24Px");
  });

  it("detects SVG markup", () => {
    expect(detectSvg('<svg viewBox="0 0 1 1"></svg>')).not.toBeNull();
    expect(detectSvg("<div></div>")).toBeNull();
  });
});
