import { cx } from "@/core/utils/cx";
import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type Tone = "mint" | "butter" | "aqua" | "coral";

export function Card({
  flat,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { flat?: boolean }) {
  return <div className={cx("b-card", flat && "b-card--flat", className)} {...rest} />;
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  active?: boolean;
  icon?: LucideIcon;
}

/** Interactive chip (toggle / action). */
export function Chip({ tone, active, icon: Icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx("b-chip", tone && `b-chip--${tone}`, active && "b-chip--active", className)}
      {...rest}
    >
      {Icon && <Icon aria-hidden />}
      {children}
    </button>
  );
}

/** Static label chip. */
export function Tag({
  tone,
  icon: Icon,
  children,
}: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={cx("b-chip", tone && `b-chip--${tone}`)}>
      {Icon && <Icon aria-hidden />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="b-kbd">{children}</kbd>;
}

export function Tile({
  icon: Icon,
  tone,
  round,
}: { icon: LucideIcon; tone: Tone; round?: boolean }) {
  return (
    <span className={cx("b-tile", `b-tile--${tone}`, round && "b-tile--round")}>
      <Icon aria-hidden />
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="b-error" role="alert">
      <AlertCircle aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <pre className={cx("b-code", className)}>{children}</pre>;
}
