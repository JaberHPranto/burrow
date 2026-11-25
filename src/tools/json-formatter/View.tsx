import type { ToolProps } from "@/core/tools/types";
import {
  Chip,
  CodeBlock,
  CopyButton,
  EmptyState,
  ErrorNote,
  PaneLabel,
  Row,
  Segmented,
  Split,
  Stack,
  Tag,
  TextArea,
} from "@/design";
import { ArrowDownAZ } from "lucide-react";
import { useMemo, useState } from "react";
import { type Indent, formatJson, parseJson, summarize } from "./logic";

const INDENTS = [
  { value: "2", label: "2 sp" },
  { value: "4", label: "4 sp" },
  { value: "tab", label: "tab" },
] as const;

const MODES = [
  { value: "pretty", label: "Prettify" },
  { value: "minify", label: "Minify" },
] as const;

export default function JsonFormatter({ initialInput = "" }: ToolProps) {
  const [input, setInput] = useState(initialInput);
  const [indent, setIndent] = useState<Indent>("2");
  const [mode, setMode] = useState<"pretty" | "minify">("pretty");
  const [sortKeys, setSortKeys] = useState(false);

  const parsed = useMemo(() => (input.trim() ? parseJson(input) : null), [input]);
  const output = useMemo(
    () =>
      parsed?.ok ? formatJson(parsed.value, { indent, minify: mode === "minify", sortKeys }) : "",
    [parsed, indent, mode, sortKeys],
  );
  const stats = useMemo(() => (parsed?.ok ? summarize(parsed.value) : null), [parsed]);

  return (
    <Stack gap={3} grow>
      <Row gap={2}>
        <Segmented label="Mode" value={mode} options={MODES} onChange={setMode} />
        {mode === "pretty" && (
          <Segmented label="Indent" value={indent} options={INDENTS} onChange={setIndent} />
        )}
        <Chip icon={ArrowDownAZ} active={sortKeys} onClick={() => setSortKeys((s) => !s)}>
          Sort keys
        </Chip>
        <span className="b-grow" />
        <CopyButton value={output} disabled={!output} />
      </Row>

      <Split>
        <Stack gap={2}>
          <PaneLabel label="Input" aside={parsed?.ok ? <Tag tone="mint">valid</Tag> : null} />
          <TextArea
            className="b-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            invalid={parsed ? !parsed.ok : false}
            placeholder='Paste JSON here, e.g. {"hello": "burrow"}'
            autoFocus
          />
          {parsed && !parsed.ok && (
            <ErrorNote>
              Line {parsed.line}, column {parsed.column}: {parsed.message}
            </ErrorNote>
          )}
        </Stack>

        <Stack gap={2}>
          <PaneLabel
            label="Output"
            aside={
              stats ? `${stats.keys} keys · depth ${stats.depth} · ${output.length} chars` : null
            }
          />
          {output ? (
            <CodeBlock className="b-grow">{output}</CodeBlock>
          ) : (
            <EmptyState
              title="Nothing to format yet"
              mood={parsed && !parsed.ok ? "oops" : "sleepy"}
            >
              {parsed && !parsed.ok ? "Fix the error on the left." : "Paste some JSON on the left."}
            </EmptyState>
          )}
        </Stack>
      </Split>
    </Stack>
  );
}
