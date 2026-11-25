import { createRng, randomSeed } from "@/core/fake/fake";
import { useWindowSize } from "@/core/platform/window";
import type { ToolProps } from "@/core/tools/types";
import {
  Button,
  Chip,
  CodeBlock,
  CopyButton,
  ErrorNote,
  FilePicker,
  Input,
  PaneLabel,
  Row,
  Segmented,
  Select,
  Slider,
  Split,
  Stack,
  Tag,
  TextArea,
} from "@/design";
import { Dices, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateMock } from "./generate";
import { EXAMPLE_SCHEMA } from "./sample";
import { type SnippetKind, buildSnippet, joinUrl } from "./snippets";
import { parseSource } from "./source";
import styles from "./styles.module.css";

const SNIPPETS = [
  { value: "json", label: "JSON" },
  { value: "curl", label: "cURL" },
  { value: "fetch", label: "fetch" },
  { value: "httpie", label: "HTTPie" },
] as const;

const METHODS = ["POST", "PUT", "PATCH", "DELETE", "GET"];

const KIND_LABEL = {
  "json-schema": "JSON Schema",
  openapi: "OpenAPI",
  example: "Example JSON",
} as const;

export default function SchemaMock({ initialInput = "" }: ToolProps) {
  const [input, setInput] = useState(initialInput);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [onlyRequired, setOnlyRequired] = useState(false);
  const [useExamples, setUseExamples] = useState(false);
  const [seed, setSeed] = useState(randomSeed);
  const [snippet, setSnippet] = useState<SnippetKind>("json");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");

  useWindowSize(1000, 640);

  const source = useMemo(() => parseSource(input), [input]);
  const operation =
    source.ok && source.kind === "openapi"
      ? (source.operations.find((o) => o.id === operationId) ?? source.operations[0])
      : null;

  // Pre-fill method + URL from the selected OpenAPI operation.
  useEffect(() => {
    if (operation && source.ok && source.kind === "openapi") {
      setMethod(operation.method);
      setUrl(joinUrl(source.baseUrl, operation.path));
    }
  }, [operation, source]);

  const result = useMemo(() => {
    if (!source.ok) return null;
    const schema = source.kind === "openapi" ? operation?.schema : source.schema;
    if (!schema) return null;
    try {
      const rng = createRng(seed);
      const make = () => generateMock(schema, source.root, { rng, onlyRequired, useExamples });
      return {
        ok: true as const,
        body: count === 1 ? make() : Array.from({ length: count }, make),
      };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
    }
  }, [source, operation, seed, count, onlyRequired, useExamples]);

  const output = result?.ok ? buildSnippet(snippet, result.body, method, url) : "";

  return (
    <Stack gap={3} grow>
      <Split>
        <Stack gap={2}>
          <PaneLabel
            label={
              source.ok ? (
                <Tag tone="mint">{KIND_LABEL[source.kind]}</Tag>
              ) : (
                "Schema, OpenAPI or example body"
              )
            }
            aside={
              <Row gap={1}>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Sparkles}
                  onClick={() => setInput(EXAMPLE_SCHEMA)}
                >
                  Example
                </Button>
                <FilePicker
                  accept=".json,application/json"
                  size="sm"
                  variant="ghost"
                  onFile={async (f) => setInput(await f.text())}
                />
              </Row>
            }
          />
          <TextArea
            className="b-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            invalid={!source.ok && !!source.message}
            placeholder={'{ "type": "object", "properties": { "email": { "type": "string" } } }'}
            autoFocus
          />
          {!source.ok && source.message && <ErrorNote>{source.message}</ErrorNote>}
          {result && !result.ok && <ErrorNote>{result.message}</ErrorNote>}

          {source.ok && source.kind === "openapi" && (
            <Select
              aria-label="Operation"
              value={operation?.id ?? ""}
              onChange={(e) => setOperationId(e.target.value)}
            >
              {source.operations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id}
                  {o.summary ? ` — ${o.summary}` : ""}
                </option>
              ))}
            </Select>
          )}

          <Row gap={3}>
            <Stack gap={1} grow>
              <span className="b-field__label">
                <span>Records</span>
                <span>{count === 1 ? "1 object" : `array of ${count}`}</span>
              </span>
              <Slider
                label="Number of records"
                min={1}
                max={20}
                value={count}
                onChange={setCount}
              />
            </Stack>
            <Chip active={onlyRequired} onClick={() => setOnlyRequired((v) => !v)}>
              Required only
            </Chip>
            <Chip active={useExamples} onClick={() => setUseExamples((v) => !v)}>
              Use examples
            </Chip>
          </Row>
        </Stack>

        <Stack gap={2}>
          <Row gap={2}>
            <Segmented label="Output" value={snippet} options={SNIPPETS} onChange={setSnippet} />
            <span className="b-grow" />
            <Button
              size="sm"
              icon={Dices}
              onClick={() => setSeed(randomSeed())}
              disabled={!result?.ok}
            >
              Shuffle
            </Button>
            <CopyButton value={output} size="sm" disabled={!output} />
          </Row>
          {snippet !== "json" && (
            <Row gap={2}>
              <Select
                aria-label="HTTP method"
                className={styles.method}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
              <Input
                aria-label="Request URL"
                className={styles.url}
                placeholder="http://localhost:3000/api/users"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Row>
          )}
          {output ? (
            <CodeBlock className="b-grow">{output}</CodeBlock>
          ) : (
            <div className={styles.placeholder}>
              Paste a schema on the left (or click <strong>Example</strong>) to generate a request
              body.
            </div>
          )}
        </Stack>
      </Split>
    </Stack>
  );
}
