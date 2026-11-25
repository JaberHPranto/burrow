import { parseColor } from "@/core/color/color";
import type { ToolProps } from "@/core/tools/types";
import { ColorInput, Field, IconButton, Row, Stack, Tag } from "@/design";
import { ArrowLeftRight, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { checkContrast, detectColor, formatRatio } from "./logic";
import styles from "./styles.module.css";

const CRITERIA = [
  { key: "aaNormal", label: "AA · normal text", min: "4.5" },
  { key: "aaLarge", label: "AA · large text", min: "3" },
  { key: "aaaNormal", label: "AAA · normal text", min: "7" },
  { key: "aaaLarge", label: "AAA · large text", min: "4.5" },
] as const;

export default function ContrastChecker({ initialInput }: ToolProps) {
  const [fg, setFg] = useState(
    initialInput && detectColor(initialInput) ? initialInput.trim() : "#88CCA6",
  );
  const [bg, setBg] = useState("#181A20");

  const result = useMemo(() => {
    const a = parseColor(fg);
    const b = parseColor(bg);
    return a && b ? checkContrast(a, b) : null;
  }, [fg, bg]);

  return (
    <Stack gap={4}>
      <Row gap={2} style={{ alignItems: "flex-end" }}>
        <Field label="Text colour" className="b-grow">
          <ColorInput label="Text colour" value={fg} onChange={setFg} />
        </Field>
        <IconButton
          icon={ArrowLeftRight}
          label="Swap colours"
          onClick={() => {
            setFg(bg);
            setBg(fg);
          }}
        />
        <Field label="Background" className="b-grow">
          <ColorInput label="Background colour" value={bg} onChange={setBg} />
        </Field>
      </Row>

      <div className={styles.preview} style={{ color: fg, background: bg }}>
        <p className={styles.large}>Large text — 24px</p>
        <p className={styles.normal}>
          Normal body text at 14px. The quick brown rabbit hops over the lazy dog.
        </p>
        <span className={styles.ratio}>{result ? formatRatio(result.ratio) : "—"}</span>
      </div>

      <div className={styles.grid}>
        {CRITERIA.map(({ key, label, min }) => {
          const pass = result?.[key] ?? false;
          return (
            <div key={key} className={styles.criterion}>
              <span>{label}</span>
              <Row gap={2}>
                <span className={styles.min}>≥ {min}:1</span>
                <Tag tone={pass ? "mint" : "coral"} icon={pass ? Check : X}>
                  {pass ? "Pass" : "Fail"}
                </Tag>
              </Row>
            </div>
          );
        })}
      </div>
    </Stack>
  );
}
