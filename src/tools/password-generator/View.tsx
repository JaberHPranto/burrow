import { Button, Card, Chip, CopyButton, Field, Row, Slider, Stack } from "@/design";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type PasswordOptions, estimateStrength, generatePassword } from "./logic";
import styles from "./styles.module.css";

const TOGGLES: Array<{ key: keyof PasswordOptions; label: string }> = [
  { key: "lower", label: "a–z" },
  { key: "upper", label: "A–Z" },
  { key: "digits", label: "0–9" },
  { key: "symbols", label: "!@#" },
  { key: "excludeAmbiguous", label: "No look-alikes" },
];

const STRENGTH_FILL = { weak: 25, fair: 50, strong: 80, excellent: 100 } as const;

export default function PasswordGenerator() {
  const [opts, setOpts] = useState<PasswordOptions>({
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: true,
  });
  const [password, setPassword] = useState("");

  const regenerate = useCallback(() => setPassword(generatePassword(opts)), [opts]);
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const strength = estimateStrength(opts);

  return (
    <Stack gap={4}>
      <Card className={styles.output}>
        <output className={`${styles.password} selectable`} aria-live="polite">
          {password || "Pick at least one character set"}
        </output>
        <Row gap={2}>
          <Button icon={RefreshCw} onClick={regenerate}>
            New
          </Button>
          <CopyButton value={password} disabled={!password} />
        </Row>
      </Card>

      <Stack gap={1}>
        <div className={styles.meter} data-strength={strength.label}>
          <span style={{ width: `${STRENGTH_FILL[strength.label]}%` }} />
        </div>
        <span className={styles.meterLabel}>
          {strength.label.charAt(0).toUpperCase() + strength.label.slice(1)} · ~{strength.bits} bits
          of entropy
        </span>
      </Stack>

      <Field label="Length" aside={opts.length}>
        <Slider
          label="Length"
          min={8}
          max={64}
          value={opts.length}
          onChange={(length) => setOpts((o) => ({ ...o, length }))}
        />
      </Field>

      <Row gap={2} style={{ flexWrap: "wrap" }}>
        {TOGGLES.map(({ key, label }) => (
          <Chip
            key={key}
            active={Boolean(opts[key])}
            onClick={() => setOpts((o) => ({ ...o, [key]: !o[key] }))}
          >
            {label}
          </Chip>
        ))}
      </Row>
    </Stack>
  );
}
