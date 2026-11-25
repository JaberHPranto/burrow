import { cx } from "@/core/utils/cx";
import type { LucideIcon } from "lucide-react";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from "react";

interface FieldProps {
  label: ReactNode;
  /** Right-aligned extra in the label row, e.g. a value readout. */
  aside?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + optional hint. Wrap any input in this. */
export function Field({ label, aside, hint, className, children }: FieldProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className={cx("b-field", className)}>
      <span className="b-field__label">
        <span>{label}</span>
        {aside != null && <span>{aside}</span>}
      </span>
      {children}
      {hint && <span className="b-field__hint">{hint}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, className, ...rest },
  ref,
) {
  const input = <input ref={ref} className={cx("b-input", className)} {...rest} />;
  if (!Icon) return input;
  return (
    <span className="b-input-wrap">
      <Icon aria-hidden />
      {input}
    </span>
  );
});

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { invalid, className, spellCheck = false, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      spellCheck={spellCheck}
      aria-invalid={invalid || undefined}
      className={cx("b-textarea", invalid && "b-textarea--invalid", className)}
      {...rest}
    />
  );
});

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("b-select", className)} {...rest} />;
}

/** Heading above a pane (input/output) — same look as a field label, no control. */
export function PaneLabel({ label, aside }: { label: ReactNode; aside?: ReactNode }) {
  return (
    <div className="b-field__label">
      <span>{label}</span>
      {aside != null && <span>{aside}</span>}
    </div>
  );
}
