import { cx } from "@/core/utils/cx";
import { CodeBlock, CopyButton, PaneLabel, Stack } from "@/design";
import type { ReactNode } from "react";
import styles from "./styles.module.css";

interface GeneratorFrameProps {
  /** Controls column. */
  children: ReactNode;
  preview: ReactNode;
  css: string;
  /** Light stage — dark shadows are invisible on the dark theme background. */
  lightStage?: boolean;
}

/** Shared layout for every generator: controls | preview + copyable CSS. */
export function GeneratorFrame({ children, preview, css, lightStage }: GeneratorFrameProps) {
  return (
    <div className={styles.frame}>
      <Stack gap={3} className={styles.controls}>
        {children}
      </Stack>
      <Stack gap={3}>
        <div className={cx(styles.stage, lightStage && styles.stageLight)}>{preview}</div>
        <PaneLabel label="CSS" aside={<CopyButton value={css} size="sm" />} />
        <CodeBlock>{css}</CodeBlock>
      </Stack>
    </div>
  );
}
