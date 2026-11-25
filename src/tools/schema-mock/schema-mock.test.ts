import { createRng } from "@/core/fake/fake";
import { describe, expect, it } from "vitest";
import { type JsonSchema, SchemaError, generateMock, resolveRef } from "./generate";
import { buildSnippet, joinUrl } from "./snippets";
import { detectSchema, inferSchema, parseSource } from "./source";

// biome-ignore lint/suspicious/noExplicitAny: loose property access on generated mock data in assertions
type Loose = any;

const opts = (seed = 1) => ({ rng: createRng(seed), onlyRequired: false, useExamples: true });

const userSchema: JsonSchema = {
  type: "object",
  required: ["id", "email", "age", "role", "tags", "address"],
  properties: {
    id: { type: "string", format: "uuid" },
    email: { type: "string" },
    age: { type: "integer", minimum: 18, maximum: 30 },
    price: { type: "number", minimum: 10, maximum: 20, multipleOf: 0.5 },
    role: { enum: ["admin", "member"] },
    tags: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
    address: {
      type: "object",
      required: ["city"],
      properties: { city: { type: "string" }, zip: { type: "string", maxLength: 4 } },
    },
    nickname: { type: "string", minLength: 12 },
  },
};

describe("generateMock", () => {
  it("respects types, formats, ranges, enums and arrays", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const v = generateMock(userSchema, userSchema, opts(seed)) as Record<string, Loose>;
      expect(v.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(v.email).toMatch(/@/);
      expect(v.age).toBeGreaterThanOrEqual(18);
      expect(v.age).toBeLessThanOrEqual(30);
      expect(Number.isInteger(v.age)).toBe(true);
      if (v.price !== undefined) expect((v.price * 2) % 1).toBe(0);
      expect(["admin", "member"]).toContain(v.role);
      expect(v.tags).toHaveLength(2);
      expect(typeof v.address.city).toBe("string");
      if (v.nickname !== undefined) expect(v.nickname.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("is deterministic for a seed", () => {
    expect(generateMock(userSchema, userSchema, opts(7))).toEqual(
      generateMock(userSchema, userSchema, opts(7)),
    );
  });

  it("can omit optional fields", () => {
    const v = generateMock(userSchema, userSchema, { ...opts(), onlyRequired: true }) as object;
    expect(Object.keys(v).sort()).toEqual(["address", "age", "email", "id", "role", "tags"]);
  });

  it("uses examples and const when asked", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["a", "b"],
      properties: { a: { type: "string", example: "hello" }, b: { const: 42 } },
    };
    expect(generateMock(schema, schema, opts())).toEqual({ a: "hello", b: 42 });
  });

  it("resolves $ref, allOf and oneOf, and stops on recursion", () => {
    const root = {
      $defs: {
        Base: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "integer", minimum: 1, maximum: 1 } },
        },
        Node: {
          allOf: [
            { $ref: "#/$defs/Base" },
            {
              type: "object",
              required: ["child"],
              properties: { child: { $ref: "#/$defs/Node" } },
            },
          ],
        },
      },
      oneOf: [{ $ref: "#/$defs/Node" }],
    };
    const v = generateMock(root as JsonSchema, root, opts()) as Record<string, Loose>;
    expect(v.id).toBe(1);
    expect(v.child.id).toBe(1);
    // recursion is cut off rather than looping forever
    let depth = 0;
    let node = v;
    while (node?.child) {
      node = node.child;
      depth++;
    }
    expect(depth).toBeLessThan(5);
  });

  it("uses field names as hints", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["firstName", "city", "createdAt", "website"],
      properties: { firstName: {}, city: {}, createdAt: {}, website: {} },
    };
    const v = generateMock(schema, schema, opts()) as Record<string, string>;
    expect(v.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v.website).toMatch(/^https:\/\//);
  });

  it("derives email from a sibling name and trims truncated strings", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name", "email", "code"],
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        code: { type: "string", maxLength: 6 },
      },
    };
    for (let seed = 1; seed < 20; seed++) {
      const v = generateMock(schema, schema, opts(seed)) as Record<string, string>;
      const first = (v.name ?? "")
        .split(" ")[0]
        ?.toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z]/g, "");
      expect(v.email?.startsWith(first ?? "?")).toBe(true);
      expect(v.code).toBe(v.code?.trimEnd());
    }
  });

  it("reports bad refs", () => {
    expect(() => resolveRef({}, "#/nope")).toThrow(SchemaError);
    expect(() => resolveRef({}, "other.json#/x")).toThrow(/local/);
  });
});

describe("parseSource", () => {
  it("recognises JSON Schema, OpenAPI and examples", () => {
    expect(parseSource(JSON.stringify(userSchema))).toMatchObject({
      ok: true,
      kind: "json-schema",
    });
    expect(parseSource('{"name":"Rafi","age":30}')).toMatchObject({ ok: true, kind: "example" });
    expect(parseSource("{oops")).toMatchObject({ ok: false });
    expect(parseSource("42")).toMatchObject({ ok: false });
  });

  it("lists OpenAPI operations with JSON request bodies", () => {
    const doc = {
      openapi: "3.0.0",
      servers: [{ url: "https://api.example.com/v1/" }],
      paths: {
        "/users": {
          get: { summary: "List" },
          post: {
            summary: "Create user",
            requestBody: {
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
          },
        },
      },
      components: {
        schemas: { User: { type: "object", properties: { email: { type: "string" } } } },
      },
    };
    const src = parseSource(JSON.stringify(doc));
    expect(src).toMatchObject({
      ok: true,
      kind: "openapi",
      baseUrl: "https://api.example.com/v1/",
    });
    if (src.ok && src.kind === "openapi") {
      expect(src.operations.map((o) => o.id)).toEqual(["POST /users"]);
      const body = generateMock(src.operations[0]?.schema ?? {}, src.root, opts()) as Record<
        string,
        string
      >;
      expect(typeof body).toBe("object");
    }
  });

  it("infers schemas from examples", () => {
    expect(
      inferSchema({
        id: "3f1c2b4a-1111-4a2b-9c3d-123456789abc",
        n: 1.5,
        tags: ["a"],
        at: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({
      type: "object",
      required: ["id", "n", "tags", "at"],
      properties: {
        id: { type: "string", format: "uuid" },
        n: { type: "number" },
        tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 1 },
        at: { type: "string", format: "date-time" },
      },
    });
  });

  it("detects schemas on the clipboard", () => {
    expect(detectSchema('{"type":"object","properties":{}}')?.score).toBeGreaterThan(0.95);
    expect(detectSchema('{"name":"x"}')).toBeNull();
  });
});

describe("snippets", () => {
  it("builds cURL with safe quoting and fetch", () => {
    const curl = buildSnippet("curl", { msg: "it's" }, "POST", "http://x/api");
    expect(curl).toContain("curl -X POST 'http://x/api'");
    expect(curl).toContain(`-d '{"msg":"it'\\''s"}'`);
    expect(buildSnippet("fetch", { a: 1 }, "PUT", "")).toContain('method: "PUT"');
  });

  it("joins urls", () => {
    expect(joinUrl("https://a.com/v1/", "/users")).toBe("https://a.com/v1/users");
    expect(joinUrl("", "/users")).toBe("/users");
  });
});
