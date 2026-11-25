/**
 * Generate realistic mock values from a JSON Schema (draft-07 / 2020-12 subset,
 * which also covers OpenAPI 3 schema objects).
 *
 * Supported: type (incl. arrays & `nullable`), properties/required, items,
 * min/maxItems, enum, const, examples/example/default, allOf, oneOf, anyOf,
 * $ref (local "#/…" pointers), string formats & length, number ranges & multipleOf.
 * Unknown keywords are ignored. Field names steer values: `email`, `price`, `city`…
 */
import { type Rng, bool, fake, float, int, pick } from "@/core/fake/fake";

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  const?: unknown;
  examples?: unknown[];
  example?: unknown;
  default?: unknown;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  nullable?: boolean;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
};

export interface GenerateOptions {
  rng: Rng;
  /** Only include required properties. */
  onlyRequired: boolean;
  /** Prefer `example`/`examples`/`default` values from the schema when present. */
  useExamples: boolean;
}

interface Ctx extends GenerateOptions {
  root: unknown;
  depth: number;
  refStack: string[];
}

const MAX_DEPTH = 8;

export class SchemaError extends Error {}

export function generateMock(schema: JsonSchema, root: unknown, opts: GenerateOptions): unknown {
  return gen(schema, { ...opts, root, depth: 0, refStack: [] }, "");
}

/** Resolve a local JSON pointer like "#/components/schemas/User". */
export function resolveRef(root: unknown, ref: string): JsonSchema {
  if (!ref.startsWith("#")) throw new SchemaError(`Only local $refs are supported (got "${ref}")`);
  const parts = ref
    .slice(1)
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p.replace(/~1/g, "/").replace(/~0/g, "~")));
  let node: unknown = root;
  for (const part of parts) {
    if (node && typeof node === "object" && part in (node as object))
      node = (node as Record<string, unknown>)[part];
    else throw new SchemaError(`Can't resolve $ref "${ref}"`);
  }
  return node as JsonSchema;
}

function mergeAllOf(parts: JsonSchema[], ctx: Ctx): JsonSchema {
  const merged: JsonSchema = { type: "object", properties: {}, required: [] };
  for (const raw of parts) {
    const part = raw.$ref ? resolveRef(ctx.root, raw.$ref) : raw;
    const resolved = part.allOf ? mergeAllOf(part.allOf, ctx) : part;
    Object.assign(merged.properties as object, resolved.properties ?? {});
    merged.required = [...(merged.required ?? []), ...(resolved.required ?? [])];
    for (const [k, v] of Object.entries(resolved)) {
      if (!["properties", "required", "allOf"].includes(k) && !(k in merged)) merged[k] = v;
    }
  }
  return merged;
}

function gen(schema: JsonSchema, ctx: Ctx, field: string): unknown {
  if (ctx.depth > MAX_DEPTH) return null;

  if (schema.$ref) {
    if (ctx.refStack.filter((r) => r === schema.$ref).length >= 2) return null; // recursion guard
    const target = resolveRef(ctx.root, schema.$ref);
    return gen(target, { ...ctx, refStack: [...ctx.refStack, schema.$ref] }, field);
  }
  if (schema.allOf?.length) return gen(mergeAllOf(schema.allOf, ctx), ctx, field);

  const branches = schema.oneOf ?? schema.anyOf;
  if (branches?.length) return gen(pick(ctx.rng, branches), ctx, field);

  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return pick(ctx.rng, schema.enum);
  if (ctx.useExamples) {
    if (Array.isArray(schema.examples) && schema.examples.length)
      return pick(ctx.rng, schema.examples);
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
  }

  let type = schema.type;
  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== "null");
    type = nonNull.length && ctx.rng() > 0.1 ? pick(ctx.rng, nonNull) : "null";
  }
  if (schema.nullable && ctx.rng() < 0.1) return null;
  if (!type) type = schema.properties ? "object" : schema.items ? "array" : "string";

  const next = { ...ctx, depth: ctx.depth + 1 };
  switch (type) {
    case "object":
      return genObject(schema, next);
    case "array":
      return genArray(schema, next, field);
    case "integer":
      return genNumber(schema, ctx.rng, field, true);
    case "number":
      return genNumber(schema, ctx.rng, field, false);
    case "boolean":
      return bool(ctx.rng);
    case "null":
      return null;
    default:
      return genString(schema, ctx.rng, field);
  }
}

function genObject(schema: JsonSchema, ctx: Ctx): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const required = new Set(schema.required ?? []);
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    if (ctx.onlyRequired && !required.has(key)) continue;
    if (!required.has(key) && ctx.rng() < 0.15) continue; // optional fields sometimes absent
    out[key] = gen(prop, ctx, key);
  }
  return correlate(out, schema, ctx.rng);
}

/** Make sibling fields agree: an `email` next to a `name` is derived from that name. */
function correlate(
  obj: Record<string, unknown>,
  schema: JsonSchema,
  rng: Rng,
): Record<string, unknown> {
  const nameKey = Object.keys(obj).find((k) => /^(name|full_?name|display_?name)$/i.test(k));
  const emailKey = Object.keys(obj).find((k) => /e-?mail/i.test(k));
  const emailSchema = emailKey ? schema.properties?.[emailKey] : undefined;
  const constrained =
    emailSchema &&
    (emailSchema.enum || emailSchema.const !== undefined || emailSchema.example !== undefined);
  const name = nameKey ? obj[nameKey] : undefined;
  if (emailKey && !constrained && typeof name === "string" && typeof obj[emailKey] === "string") {
    return { ...obj, [emailKey]: fake.email(rng, name) };
  }
  return obj;
}

function genArray(schema: JsonSchema, ctx: Ctx, field: string): unknown[] {
  const min = schema.minItems ?? 1;
  const max = Math.max(min, schema.maxItems ?? Math.min(min + 2, 3));
  const count = int(ctx.rng, min, max);
  const items = schema.items;
  if (Array.isArray(items)) return items.map((s) => gen(s, ctx, singular(field)));
  return Array.from({ length: count }, () =>
    gen(items ?? { type: "string" }, ctx, singular(field)),
  );
}

const singular = (field: string) => field.replace(/(ies)$/i, "y").replace(/s$/i, "");

/* ---------------- Numbers ---------------- */

function genNumber(schema: JsonSchema, rng: Rng, field: string, integer: boolean): number {
  const f = field.toLowerCase();
  let [min, max] = numberHint(f, integer);
  if (typeof schema.minimum === "number") min = schema.minimum;
  if (typeof schema.maximum === "number") max = schema.maximum;
  if (typeof schema.exclusiveMinimum === "number")
    min = schema.exclusiveMinimum + (integer ? 1 : 0.01);
  if (typeof schema.exclusiveMaximum === "number")
    max = schema.exclusiveMaximum - (integer ? 1 : 0.01);
  if (schema.exclusiveMinimum === true && typeof schema.minimum === "number")
    min += integer ? 1 : 0.01;
  if (schema.exclusiveMaximum === true && typeof schema.maximum === "number")
    max -= integer ? 1 : 0.01;
  if (max < min) max = min;

  if (schema.multipleOf && schema.multipleOf > 0) {
    const step = schema.multipleOf;
    const lo = Math.ceil(min / step);
    const hi = Math.floor(max / step);
    return hi >= lo ? Number((int(rng, lo, hi) * step).toFixed(10)) : min;
  }
  return integer ? int(rng, Math.ceil(min), Math.floor(max)) : float(rng, min, max, 2);
}

function numberHint(f: string, integer: boolean): [number, number] {
  if (/(price|amount|total|cost|fee|salary|balance)/.test(f)) return [1, 500];
  if (/(age)$/.test(f)) return [18, 70];
  if (/(qty|quantity|count|stock|items)/.test(f)) return [1, 10];
  if (/(rating|stars|score)/.test(f)) return [1, 5];
  if (/(percent|percentage|progress)/.test(f)) return [0, 100];
  if (/year/.test(f)) return [1990, 2026];
  if (/(lat|latitude)$/.test(f)) return [-90, 90];
  if (/(lng|lon|longitude)$/.test(f)) return [-180, 180];
  if (/(page)$/.test(f)) return [1, 20];
  if (/(limit|size|per_?page)$/.test(f)) return [10, 50];
  return integer ? [1, 1000] : [0, 1000];
}

/* ---------------- Strings ---------------- */

const FORMAT_GENERATORS: Record<string, (rng: Rng) => string> = {
  email: (rng) => fake.email(rng),
  "idn-email": (rng) => fake.email(rng),
  uuid: (rng) => fake.uuid(rng),
  "date-time": (rng) => fake.dateTime(rng),
  date: (rng) => fake.date(rng),
  time: (rng) => fake.dateTime(rng).slice(11, 19),
  uri: (rng) => fake.url(rng),
  url: (rng) => fake.url(rng),
  "uri-reference": (rng) => `/${fake.words(rng, 1)}/${int(rng, 1, 99)}`,
  hostname: (rng) => `${fake.words(rng, 1)}.example.com`,
  ipv4: (rng) => fake.ipv4(rng),
  ipv6: () => "2001:db8::1",
  password: (rng) => fake.password(rng),
  byte: (rng) => btoa(fake.words(rng, 3)),
  phone: (rng) => fake.phone(rng),
};

/** Field-name heuristics, checked in order. */
const NAME_HINTS: Array<[RegExp, (rng: Rng) => string]> = [
  [/e-?mail/, (rng) => fake.email(rng)],
  [/^(id|.*_id|.*Id|uuid|guid)$/, (rng) => fake.uuid(rng)],
  [/first_?name|given_?name/, fake.firstName],
  [/last_?name|family_?name|surname/, fake.lastName],
  [/user_?name|handle|login/, fake.username],
  [/^(name|full_?name|display_?name|author|customer)$/, fake.fullName],
  [/phone|mobile|tel/, fake.phone],
  [/password|passwd|secret/, fake.password],
  [/(street|address_?line|address)/, fake.street],
  [/city|town/, fake.city],
  [/country/, fake.country],
  [/zip|postal|post_?code/, fake.zip],
  [/company|organi[sz]ation|employer/, fake.company],
  [/product|item_?name/, fake.product],
  [
    /(avatar|image|photo|picture|thumbnail)/,
    (rng) => `https://picsum.photos/seed/${int(rng, 1, 999)}/200`,
  ],
  [/(url|link|website|homepage|href)/, fake.url],
  [/slug/, (rng) => fake.words(rng, 3).replace(/ /g, "-")],
  [/colou?r/, fake.hexColor],
  [/currency/, (rng) => pick(rng, ["BDT", "USD", "EUR", "MYR", "SGD"])],
  [/(lang|locale)$/, (rng) => pick(rng, ["en", "bn", "en-US", "ms"])],
  [
    /(token|api_?key|hash)/,
    (rng) => Array.from({ length: 32 }, () => int(rng, 0, 15).toString(16)).join(""),
  ],
  [/(created|updated|deleted|_at|At)$|timestamp/, fake.dateTime],
  [/(date|dob|birthday)/, fake.date],
  [/(status|state)$/, (rng) => pick(rng, ["active", "pending", "inactive"])],
  [/(role)$/, (rng) => pick(rng, ["admin", "editor", "viewer"])],
  [/(title|subject|heading)/, (rng) => fake.sentence(rng).replace(/\.$/, "")],
  [/(description|bio|summary|comment|message|body|content|note)/, fake.sentence],
];

function genString(schema: JsonSchema, rng: Rng, field: string): string {
  const fromFormat = schema.format ? FORMAT_GENERATORS[schema.format] : undefined;
  const hint = NAME_HINTS.find(([re]) => re.test(field) || re.test(field.toLowerCase()));
  let value = fromFormat ? fromFormat(rng) : hint ? hint[1](rng) : fake.words(rng, int(rng, 1, 3));

  if (schema.minLength !== undefined) {
    while (value.length < schema.minLength) value += ` ${fake.words(rng, 2)}`;
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    value = value.slice(0, schema.maxLength);
    // Avoid a trailing space when it doesn't break minLength.
    const trimmed = value.trimEnd();
    if (trimmed.length >= (schema.minLength ?? 0)) value = trimmed;
  }
  return value;
}
