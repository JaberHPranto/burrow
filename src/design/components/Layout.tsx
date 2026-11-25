import { cx } from "@/core/utils/cx";
import type { CSSProperties, HTMLAttributes } from "react";

type Gap = 1 | 2 | 3 | 4 | 5 | 6;

interface LayoutProps extends HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  grow?: boolean;
}

function gapStyle(gap: Gap | undefined, style?: CSSProperties): CSSProperties | undefined {
  return gap ? ({ ...style, "--gap": `var(--space-${gap})` } as CSSProperties) : style;
}

/** Vertical flex column. */
export function Stack({ gap, grow, className, style, ...rest }: LayoutProps) {
  return (
    <div
      className={cx("b-stack", grow && "b-grow", className)}
      style={gapStyle(gap, style)}
      {...rest}
    />
  );
}

/** Horizontal flex row, vertically centred. */
export function Row({ gap, grow, className, style, ...rest }: LayoutProps) {
  return (
    <div
      className={cx("b-row", grow && "b-grow", className)}
      style={gapStyle(gap, style)}
      {...rest}
    />
  );
}

/** Two equal panes (input | output). */
export function Split({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("b-split", className)} {...rest} />;
}
