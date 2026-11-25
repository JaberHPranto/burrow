import type { ToolProps } from "@/core/tools/types";
import {
  Chip,
  CodeBlock,
  CopyButton,
  EmptyState,
  ErrorNote,
  FilePicker,
  Input,
  PaneLabel,
  Row,
  Segmented,
  Split,
  Stack,
  Tag,
  TextArea,
} from "@/design";
import { useMemo, useState } from "react";
import { svgToComponent } from "./jsx";
import { optimizeSvg } from "./optimize";
import styles from "./styles.module.css";

type Output = "optimized" | "jsx";

const OUTPUTS = [
  { value: "optimized", label: "Optimized SVG" },
  { value: "jsx", label: "React component" },
] as const;

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export default function SvgTools({ initialInput = "" }: ToolProps) {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState<Output>("optimized");
  const [name, setName] = useState("Icon");
  const [typescript, setTypescript] = useState(true);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true as const, ...optimizeSvg(input) };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message.split("\n")[0] : "Invalid SVG",
      };
    }
  }, [input]);

  const text = useMemo(() => {
    if (!result?.ok) return "";
    return output === "jsx" ? svgToComponent(result.data, { name, typescript }) : result.data;
  }, [result, output, name, typescript]);

  const saved = result?.ok ? Math.max(0, 1 - result.after / result.before) : 0;
  const previewSrc = result?.ok
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.data)}`
    : "";

  return (
    <Stack gap={3} grow>
      <Row gap={2}>
        <Segmented label="Output" value={output} options={OUTPUTS} onChange={setOutput} />
        {output === "jsx" && (
          <>
            <Input
              aria-label="Component name"
              className={styles.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Chip active={typescript} onClick={() => setTypescript((t) => !t)}>
              TypeScript
            </Chip>
          </>
        )}
        <span className="b-grow" />
        <CopyButton value={text} disabled={!text} />
      </Row>

      <Split>
        <Stack gap={2}>
          <PaneLabel
            label="SVG input"
            aside={
              <FilePicker
                accept=".svg,image/svg+xml"
                size="sm"
                variant="ghost"
                onFile={async (file) => {
                  setInput(await file.text());
                  setName(file.name);
                }}
              />
            }
          />
          <TextArea
            className="b-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            invalid={result ? !result.ok : false}
            placeholder="<svg …>…</svg>"
            autoFocus
          />
          {result && !result.ok && <ErrorNote>{result.message}</ErrorNote>}
        </Stack>

        <Stack gap={2}>
          <PaneLabel
            label="Result"
            aside={
              result?.ok ? (
                <Tag tone="mint">
                  {formatBytes(result.before)} → {formatBytes(result.after)} (−
                  {Math.round(saved * 100)}%)
                </Tag>
              ) : null
            }
          />
          {result?.ok ? (
            <>
              <div className={styles.preview}>
                <img src={previewSrc} alt="SVG preview" />
              </div>
              <CodeBlock className="b-grow">{text}</CodeBlock>
            </>
          ) : (
            <EmptyState title="No SVG yet" mood="sleepy">
              Paste markup or open an .svg file.
            </EmptyState>
          )}
        </Stack>
      </Split>
    </Stack>
  );
}
