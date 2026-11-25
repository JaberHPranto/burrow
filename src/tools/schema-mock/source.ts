/**
 * Turn whatever the user pasted into a schema to generate from:
 *  - a JSON Schema
 *  - an OpenAPI 3 document (pick an operation with a JSON request body)
 *  - an example payload (schema is inferred from it)
 */
import type { JsonSchema } from "./generate";

export type SourceKind = "json-schema" | "openapi" | "example";

export interface Operation {
  id: string;
  method: string;
  path: string;
  summary?: string;
  schema: JsonSchema;
}

export type Source =
  | { ok: true; kind: "json-schema"; schema: JsonSchema; root: unknown }
  | { ok: true; kind: "openapi"; operations: Operation[]; root: unknown; baseUrl: string }
  | { ok: true; kind: "example"; schema: JsonSchema; root: unknown }
  | { ok: false; message: string };

const SCHEMA_KEYS = [
  "$schema",
  "properties",
  "items",
  "allOf",
  "oneOf",
  "anyOf",
  "$ref",
  "$defs",
  "definitions",
];

export function looksLikeSchema(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (SCHEMA_KEYS.some((k) => k in obj)) return true;
  return (
    typeof obj.type === "string" &&
    ["object", "array", "string", "number", "integer", "boolean"].includes(obj.type)
  );
}

const isOpenApi = (v: unknown) =>
  !!v && typeof v === "object" && ("openapi" in v || "swagger" in v) && "paths" in v;

export function parseSource(text: string): Source {
  if (!text.trim()) return { ok: false, message: "" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      message: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (isOpenApi(value)) {
    const operations = listOperations(value as Record<string, unknown>);
    if (!operations.length)
      return { ok: false, message: "No operations with a JSON request body found." };
    const servers = (value as { servers?: Array<{ url?: string }> }).servers;
    return { ok: true, kind: "openapi", operations, root: value, baseUrl: servers?.[0]?.url ?? "" };
  }
  if (looksLikeSchema(value))
    return { ok: true, kind: "json-schema", schema: value as JsonSchema, root: value };
  if (value && typeof value === "object")
    return { ok: true, kind: "example", schema: inferSchema(value), root: value };
  return {
    ok: false,
    message: "Paste a JSON Schema, an OpenAPI document or an example JSON body.",
  };
}

const METHODS = ["post", "put", "patch", "delete", "get"];

function listOperations(doc: Record<string, unknown>): Operation[] {
  const ops: Operation[] = [];
  const paths = (doc.paths ?? {}) as Record<string, Record<string, unknown>>;
  for (const [path, item] of Object.entries(paths)) {
    for (const method of METHODS) {
      const op = item?.[method] as
        | {
            operationId?: string;
            summary?: string;
            requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
          }
        | undefined;
      const content = op?.requestBody?.content ?? {};
      const json = Object.entries(content).find(([type]) => type.includes("json"))?.[1];
      if (json?.schema) {
        ops.push({
          id: `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase(),
          path,
          summary: op?.summary ?? op?.operationId,
          schema: json.schema,
        });
      }
    }
  }
  return ops;
}

/** Infer a schema from an example value. All keys of an object become required. */
export function inferSchema(value: unknown): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length ? inferSchema(value[0]) : {},
      minItems: Math.min(value.length, 3),
      maxItems: Math.max(value.length, 1),
    };
  }
  switch (typeof value) {
    case "object": {
      const props = Object.fromEntries(
        Object.entries(value as object).map(([k, v]) => [k, inferSchema(v)]),
      );
      return { type: "object", properties: props, required: Object.keys(props) };
    }
    case "number":
      return { type: Number.isInteger(value) ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
    default: {
      const s = String(value);
      const format = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
        ? "email"
        : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
          ? "uuid"
          : /^\d{4}-\d{2}-\d{2}T/.test(s)
            ? "date-time"
            : /^\d{4}-\d{2}-\d{2}$/.test(s)
              ? "date"
              : /^https?:\/\//.test(s)
                ? "uri"
                : undefined;
      return format ? { type: "string", format } : { type: "string" };
    }
  }
}

export function detectSchema(text: string) {
  const first = text[0];
  if (first !== "{") return null;
  try {
    const value = JSON.parse(text);
    if (isOpenApi(value)) return { score: 0.97, label: "Mock request from OpenAPI" };
    if (looksLikeSchema(value)) return { score: 0.97, label: "Mock data from schema" };
  } catch {
    // not JSON
  }
  return null;
}
