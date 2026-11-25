import { readImagePixels, useImageInput } from "@/core/hooks/useImageInput";
import { clipboard } from "@/core/platform/clipboard";
import {
  CodeBlock,
  CopyButton,
  EmptyState,
  ErrorNote,
  FilePicker,
  Kbd,
  Row,
  Segmented,
  Slider,
  Stack,
  toast,
} from "@/design";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ExportFormat, type PaletteColor, exportPalette, extractPalette } from "./logic";
import styles from "./styles.module.css";

const FORMATS = [
  { value: "hex", label: "HEX" },
  { value: "css", label: "CSS vars" },
  { value: "tailwind", label: "Tailwind" },
] as const;

export default function PaletteFromImage() {
  const [image, setImage] = useState<{ url: string; pixels: Uint8ClampedArray } | null>(null);
  const [count, setCount] = useState(6);
  const [format, setFormat] = useState<ExportFormat>("hex");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (file: Blob) => {
    try {
      setError(null);
      const next = await readImagePixels(file);
      setImage(next);
    } catch {
      setError("Couldn't read that image.");
    }
  }, []);

  useImageInput(load);
  // Revoke each object URL when it's replaced or the tool closes.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  const palette: PaletteColor[] = useMemo(
    () => (image ? extractPalette(image.pixels, count) : []),
    [image, count],
  );
  const exported = useMemo(() => exportPalette(palette, format), [palette, format]);

  if (!image) {
    return (
      <Stack gap={3} grow style={{ justifyContent: "center" }}>
        <EmptyState
          title="Drop, paste or open an image"
          mood="curious"
          action={
            <FilePicker accept="image/*" onFile={load} label="Open image" variant="primary" />
          }
        >
          Drag a screenshot here or press <Kbd>Ctrl</Kbd> <Kbd>V</Kbd> to pull its colours.
        </EmptyState>
        {error && <ErrorNote>{error}</ErrorNote>}
      </Stack>
    );
  }

  return (
    <Stack gap={3} grow>
      <Row gap={3}>
        <img src={image.url} alt="Source" className={styles.thumb} />
        <Stack gap={1} grow>
          <span className="b-field__label">Colours · {count}</span>
          <Slider label="Number of colours" min={2} max={12} value={count} onChange={setCount} />
        </Stack>
        <FilePicker accept="image/*" onFile={load} label="Another" />
      </Row>

      <div className={styles.swatches}>
        {palette.map((c) => (
          <button
            key={c.hex}
            type="button"
            className={styles.swatch}
            style={{ background: c.hex, flexGrow: Math.max(c.share * 100, 6) }}
            title={`Copy ${c.hex}`}
            onClick={async () => {
              await clipboard.writeText(c.hex);
              toast.success(`Copied ${c.hex}`);
            }}
          >
            <span>{c.hex}</span>
            <span>{Math.round(c.share * 100)}%</span>
          </button>
        ))}
      </div>

      <Row gap={2}>
        <Segmented label="Export format" value={format} options={FORMATS} onChange={setFormat} />
        <span className="b-grow" />
        <CopyButton value={exported} />
      </Row>
      <CodeBlock className="b-grow">{exported}</CodeBlock>
    </Stack>
  );
}
