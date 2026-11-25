import { parseColor, toHex } from "@/core/color/color";
import { cx } from "@/core/utils/cx";
import { useEffect, useState } from "react";

interface ColorInputProps {
  /** Any CSS colour string; the swatch shows it when valid. */
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}

/** Free-text colour field with a clickable swatch that opens the native picker. */
export function ColorInput({ value, onChange, label, className }: ColorInputProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const parsed = parseColor(draft);
  const swatchHex = parsed ? toHex(parsed) : "#000000";

  return (
    <span className={cx("b-color-input", !parsed && "b-color-input--invalid", className)}>
      <label
        className="b-color-input__swatch"
        style={{ background: parsed ? draft : "transparent" }}
      >
        <input
          type="color"
          aria-label={`${label} picker`}
          value={swatchHex}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
        />
      </label>
      <input
        className="b-color-input__text"
        aria-label={label}
        aria-invalid={!parsed || undefined}
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          if (parseColor(e.target.value)) onChange(e.target.value);
        }}
      />
    </span>
  );
}
