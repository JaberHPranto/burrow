import { clipboard } from "@/core/platform/clipboard";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonVariant } from "./Button";
import { toast } from "./Toast";

interface CopyButtonProps {
  /** Text to copy, or a function that produces it on click. */
  value: string | (() => string);
  label?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function CopyButton({
  value,
  label = "Copy",
  variant = "primary",
  size = "md",
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = typeof value === "function" ? value() : value;
    try {
      await clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      icon={copied ? Check : Copy}
      onClick={copy}
      disabled={disabled}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
