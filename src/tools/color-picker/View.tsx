import { type Rgb, colorFormats, parseColor, readableOn, toHex } from "@/core/color/color";
import { clipboard } from "@/core/platform/clipboard";
import { commands, isCancelled } from "@/core/platform/commands";
import { usePersistentState } from "@/core/storage/usePersistentState";
import type { ToolProps } from "@/core/tools/types";
import { Button, ColorInput, IconButton, PaneLabel, Row, Stack, toast } from "@/design";
import { Copy, Pipette, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectColor, pushHistory } from "./logic";
import styles from "./styles.module.css";

const LABELS = { hex: "HEX", rgb: "RGB", hsl: "HSL", oklch: "OKLCH" } as const;

export default function ColorPicker({ autoRun, initialInput }: ToolProps) {
  const initial =
    initialInput && detectColor(initialInput) ? parseColor(initialInput.trim()) : null;
  const [color, setColor] = useState<Rgb>(initial ?? { r: 136, g: 204, b: 166 });
  const [history, setHistory] = usePersistentState<string[]>("color-picker", "history", []);
  const [picking, setPicking] = useState(false);

  const remember = useCallback((c: Rgb) => setHistory((h) => pushHistory(h, c)), [setHistory]);

  const pick = useCallback(async () => {
    setPicking(true);
    try {
      const picked = await commands.pickColor();
      setColor(picked);
      remember(picked);
      // Auto-copy is a convenience: a clipboard failure must not look like a failed pick.
      try {
        await clipboard.writeText(toHex(picked));
        toast.success(`${toHex(picked)} copied`);
      } catch {
        toast.success(`Picked ${toHex(picked)}`);
      }
    } catch (err) {
      if (!isCancelled(err)) toast.error(String(err));
    } finally {
      setPicking(false);
    }
  }, [remember]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (autoRun) void pick();
  }, [autoRun, pick]);

  const formats = colorFormats(color);
  const fg = readableOn(color);

  async function copy(value: string) {
    await clipboard.writeText(value);
    toast.success(`Copied ${value}`);
  }

  return (
    <div className={styles.layout}>
      <Stack gap={3}>
        <div className={styles.swatch} style={{ background: formats.hex, color: fg }}>
          <span className={styles.swatchHex}>{formats.hex.toUpperCase()}</span>
          <Button variant="inverted" icon={Pipette} onClick={pick} disabled={picking}>
            {picking ? "Click anywhere…" : "Pick from screen"}
          </Button>
        </div>
        <ColorInput
          label="Colour value"
          value={formats.hex}
          onChange={(v) => {
            const parsed = parseColor(v);
            if (parsed) setColor(parsed);
          }}
        />
      </Stack>

      <Stack gap={3}>
        <Stack gap={2}>
          <PaneLabel label="Formats" aside="click to copy" />
          {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => (
            <button
              key={key}
              type="button"
              className={styles.format}
              onClick={() => copy(formats[key])}
            >
              <span className={styles.formatLabel}>{LABELS[key]}</span>
              <code className={styles.formatValue}>{formats[key]}</code>
              <Copy aria-hidden className={styles.formatIcon} />
            </button>
          ))}
        </Stack>

        <Stack gap={2}>
          <PaneLabel
            label="Recent picks"
            aside={
              history.length > 0 && (
                <IconButton icon={Trash2} label="Clear history" onClick={() => setHistory([])} />
              )
            }
          />
          {history.length === 0 ? (
            <p className={styles.hint}>Colours you pick land here.</p>
          ) : (
            <Row gap={2} style={{ flexWrap: "wrap" }}>
              {history.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={styles.historyChip}
                  style={{ background: hex }}
                  title={hex}
                  aria-label={`Use ${hex}`}
                  onClick={() => {
                    const parsed = parseColor(hex);
                    if (parsed) setColor(parsed);
                  }}
                />
              ))}
            </Row>
          )}
        </Stack>
      </Stack>
    </div>
  );
}
