/** Request snippets for API testing. */

export type SnippetKind = "json" | "curl" | "fetch" | "httpie";

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function buildSnippet(
  kind: SnippetKind,
  body: unknown,
  method: string,
  url: string,
): string {
  const json = JSON.stringify(body, null, 2);
  const target = url || "http://localhost:3000/api";
  switch (kind) {
    case "json":
      return json;
    case "curl":
      return [
        `curl -X ${method} ${shellQuote(target)} \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d ${shellQuote(JSON.stringify(body))}`,
      ].join("\n");
    case "httpie":
      return `echo ${shellQuote(JSON.stringify(body))} | http ${method} ${shellQuote(target)}`;
    case "fetch":
      return [
        `await fetch(${JSON.stringify(target)}, {`,
        `  method: ${JSON.stringify(method)},`,
        `  headers: { "Content-Type": "application/json" },`,
        `  body: JSON.stringify(${json.replace(/\n/g, "\n  ")}),`,
        "});",
      ].join("\n");
  }
}

/** Join a server base URL and an OpenAPI path without doubling slashes. */
export function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
