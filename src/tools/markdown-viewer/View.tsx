import { usePersistentState } from "@/core/storage/usePersistentState";
import type { ToolProps } from "@/core/tools/types";
import { cx } from "@/core/utils/cx";
import { CopyButton, FilePicker, Row, Segmented, Stack, Tag, TextArea } from "@/design";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { documentStats } from "./logic";
import { renderMarkdown } from "./render";
import styles from "./styles.module.css";

type Mode = "split" | "preview" | "edit";

const MODES = [
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
  { value: "edit", label: "Edit" },
] as const;

const SAMPLE = `# Welcome to the burrow 🐇

Paste or open a **Markdown** file to preview it.

- GitHub-flavoured tables, task lists and code
- Your last document is kept between sessions

\`\`\`ts
const hop = () => "🥕";
\`\`\`
`;

export default function MarkdownViewer({ initialInput }: ToolProps) {
  const [doc, setDoc, loaded] = usePersistentState("markdown-viewer", "doc", SAMPLE);
  const [mode, setMode] = useState<Mode>("split");

  // A clipboard suggestion replaces the stored document once it has loaded.
  useEffect(() => {
    if (loaded && initialInput) setDoc(initialInput);
  }, [loaded, initialInput, setDoc]);

  const deferred = useDeferredValue(doc);
  const html = useMemo(() => renderMarkdown(deferred), [deferred]);
  const stats = documentStats(doc);

  return (
    <Stack gap={3} grow>
      <Row gap={2}>
        <Segmented label="View" value={mode} options={MODES} onChange={setMode} />
        <FilePicker
          accept=".md,.markdown,.mdx,.txt,text/markdown"
          size="sm"
          variant="ghost"
          onFile={async (file) => setDoc(await file.text())}
        />
        <span className="b-grow" />
        <Tag>
          {stats.words} words · {stats.minutes} min read
        </Tag>
        <CopyButton value={() => html} label="Copy HTML" variant="secondary" size="sm" />
      </Row>

      <div className={cx(styles.panes, styles[mode])}>
        {mode !== "preview" && (
          <TextArea
            aria-label="Markdown source"
            className={styles.editor}
            value={doc}
            onChange={(e) => setDoc(e.target.value)}
            autoFocus
          />
        )}
        {mode !== "edit" && (
          <article
            className={cx(styles.prose, "selectable")}
            // Sanitised by DOMPurify in renderMarkdown.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised HTML
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </Stack>
  );
}
