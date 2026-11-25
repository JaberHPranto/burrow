/**
 * Convert SVG markup into a React component. Small and dependency-free:
 * attribute renaming, style objects, pretty indentation and a typed wrapper.
 */

const SPECIAL_ATTRS: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  "xlink:href": "xlinkHref",
  "xml:space": "xmlSpace",
  "xml:lang": "xmlLang",
  "xmlns:xlink": "xmlnsXlink",
};

const camel = (s: string) => s.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());

export function jsxAttributeName(name: string): string {
  if (SPECIAL_ATTRS[name]) return SPECIAL_ATTRS[name];
  if (name.startsWith("data-") || name.startsWith("aria-")) return name;
  return camel(name);
}

/** `fill: red; stroke-width: 2` → `{{ fill: "red", strokeWidth: "2" }}` */
export function styleToObject(style: string): string {
  const entries = style
    .split(";")
    .map((decl) => decl.split(/:(.*)/s).map((s) => s.trim()))
    .filter(([prop, value]) => prop && value)
    .map(([prop, value]) => {
      const key = (prop as string).startsWith("--") ? JSON.stringify(prop) : camel(prop as string);
      return `${key}: ${JSON.stringify(value)}`;
    });
  return `{{ ${entries.join(", ")} }}`;
}

const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;

function convertTag(tag: string, isRoot: boolean): string {
  if (tag.startsWith("</")) return tag;
  const match = /^<([^\s/>]+)([\s\S]*?)(\/?)>$/.exec(tag);
  if (!match) return tag;
  const [, name, rawAttrs = "", selfClose] = match;
  const attrs: string[] = [];
  for (const m of rawAttrs.matchAll(ATTR_RE)) {
    const [, attr, dq, sq] = m;
    if (!attr) continue;
    const value = dq ?? sq;
    const jsxName = jsxAttributeName(attr);
    if (value === undefined) attrs.push(jsxName);
    else if (attr === "style") attrs.push(`style=${styleToObject(value)}`);
    else attrs.push(`${jsxName}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (isRoot) attrs.push("{...props}");
  return `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClose ? " />" : ">"}`;
}

/** Strip prolog/comments, convert tags, and indent one element per line. */
export function svgToJsxMarkup(svg: string): string {
  const cleaned = svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  const tokens = cleaned.match(/<[^>]+>|[^<]+/g) ?? [];
  const lines: string[] = [];
  let depth = 0;
  let seenRoot = false;

  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    if (!token.startsWith("<")) {
      lines.push(`${"  ".repeat(depth)}{${JSON.stringify(token)}}`);
      continue;
    }
    const closing = token.startsWith("</");
    const selfClosing = token.endsWith("/>");
    if (closing) depth = Math.max(0, depth - 1);
    const isRoot = !seenRoot && !closing && /^<svg[\s>]/i.test(token);
    if (isRoot) seenRoot = true;
    lines.push(`${"  ".repeat(depth)}${convertTag(token, isRoot)}`);
    if (!closing && !selfClosing) depth += 1;
  }
  return lines.join("\n");
}

export function toComponentName(input: string): string {
  const name = input
    .replace(/\.svg$/i, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Z]/.test(name) ? name : `Svg${name || "Icon"}`;
}

export function svgToComponent(svg: string, opts: { name: string; typescript: boolean }): string {
  const name = toComponentName(opts.name);
  const body = svgToJsxMarkup(svg)
    .split("\n")
    .map((l) => `    ${l}`)
    .join("\n");
  const header = opts.typescript ? 'import type { SVGProps } from "react";\n\n' : "";
  const params = opts.typescript ? "props: SVGProps<SVGSVGElement>" : "props";
  return `${header}export function ${name}(${params}) {\n  return (\n${body}\n  );\n}\n`;
}

export function detectSvg(text: string) {
  return /^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text) &&
    /<\/svg>\s*$/i.test(text)
    ? { score: 0.9, label: "Optimize SVG / to JSX" }
    : null;
}
