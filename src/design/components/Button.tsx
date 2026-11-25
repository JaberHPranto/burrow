import { cx } from "@/core/utils/cx";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "inverted" | "outlined" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("b-btn", `b-btn--${variant}`, size === "sm" && "b-btn--sm", className)}
      {...rest}
    >
      {Icon && <Icon aria-hidden />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Required: used as the accessible name and tooltip. */
  label: string;
}

export function IconButton({
  icon: Icon,
  label,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx("b-icon-btn", className)}
      {...rest}
    >
      <Icon aria-hidden />
    </button>
  );
}
