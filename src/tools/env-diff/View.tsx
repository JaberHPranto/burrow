import type { ToolProps } from "@/core/tools/types";
import {
  Chip,
  CopyButton,
  FilePicker,
  PaneLabel,
  Row,
  Split,
  Stack,
  Tag,
  TextArea,
  type Tone,
} from "@/design";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { type EnvDiff, buildExample, diffEnv, maskValue, parseEnv } from "./logic";
import styles from "./styles.module.css";

const GROUPS: ReadonlyArray<{ key: keyof EnvDiff; title: string; tone: Tone; hint: string }> = [
  { key: "missing", title: "Missing", tone: "coral", hint: "in example, not in .env" },
  { key: "empty", title: "Empty", tone: "butter", hint: "defined but blank" },
  { key: "extra", title: "Undocumented", tone: "aqua", hint: "in .env, not in example" },
  { key: "ok", title: "OK", tone: "mint", hint: "present in both" },
];

export default function EnvDiffView({ initialInput = "" }: ToolProps) {
  const [envText, setEnvText] = useState(initialInput);
  const [exampleText, setExampleText] = useState("");
  const [reveal, setReveal] = useState(false);

  const env = useMemo(() => parseEnv(envText), [envText]);
  const example = useMemo(() => parseEnv(exampleText), [exampleText]);
  const diff = useMemo(() => diffEnv(env, example), [env, example]);
  const hasInput = env.size > 0 || example.size > 0;

  return (
    <Stack gap={3} grow>
      <Split className={styles.inputs}>
        <Stack gap={2}>
          <PaneLabel
            label=".env"
            aside={
              <FilePicker
                accept="*"
                size="sm"
                variant="ghost"
                onFile={async (f) => setEnvText(await f.text())}
              />
            }
          />
          <TextArea
            className={`b-grow ${reveal ? "" : styles.masked}`}
            value={envText}
            onChange={(e) => setEnvText(e.target.value)}
            placeholder="DATABASE_URL=…"
            autoFocus
          />
        </Stack>
        <Stack gap={2}>
          <PaneLabel
            label=".env.example"
            aside={
              <FilePicker
                accept="*"
                size="sm"
                variant="ghost"
                onFile={async (f) => setExampleText(await f.text())}
              />
            }
          />
          <TextArea
            className="b-grow"
            value={exampleText}
            onChange={(e) => setExampleText(e.target.value)}
            placeholder="DATABASE_URL="
          />
        </Stack>
      </Split>

      <Row gap={2}>
        <Chip icon={reveal ? EyeOff : Eye} active={reveal} onClick={() => setReveal((r) => !r)}>
          {reveal ? "Hide values" : "Show values"}
        </Chip>
        <span className="b-grow" />
        <CopyButton
          label="Copy updated .env.example"
          variant="secondary"
          size="sm"
          value={() => buildExample(env, example)}
          disabled={!hasInput}
        />
      </Row>

      {hasInput && (
        <div className={styles.groups}>
          {GROUPS.map(({ key, title, tone, hint }) => (
            <section key={key} className={styles.group}>
              <header>
                <Tag tone={tone}>
                  {title} · {diff[key].length}
                </Tag>
                <span className={styles.hint}>{hint}</span>
              </header>
              <ul>
                {diff[key].map((k) => (
                  <li key={k}>
                    <code>{k}</code>
                    {key !== "missing" && env.has(k) && (
                      <span className={styles.value}>
                        {reveal ? env.get(k) || "(empty)" : maskValue(env.get(k) ?? "")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Stack>
  );
}
