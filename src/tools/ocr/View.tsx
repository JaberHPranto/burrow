import { useApp } from "@/app/store";
import type { AiHandoff } from "@/core/ai/AiToolView";
import { useSnip } from "@/core/capture/useSnip";
import { useDeps } from "@/core/deps/store";
import { handoff } from "@/core/handoff";
import { useImageInput } from "@/core/hooks/useImageInput";
import { type OcrStatus, commands, isCancelled } from "@/core/platform/commands";
import { usePersistentState } from "@/core/storage/usePersistentState";
import type { ToolProps } from "@/core/tools/types";
import {
  Button,
  Chip,
  CopyButton,
  EmptyState,
  ErrorNote,
  FilePicker,
  Kbd,
  PaneLabel,
  Row,
  Segmented,
  Select,
  Stack,
  Tag,
  TextArea,
} from "@/design";
import { Camera, Languages, ScrollText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Layout, cleanOcrText, languageOptions, wordCount } from "./logic";
import styles from "./styles.module.css";

/** OCR → AI: hand the text to an AI tool and run it straight away. */
const AI_ACTIONS = [
  { tool: "ai-summarize", label: "Summarise", icon: ScrollText },
  { tool: "ai-translate", label: "Translate", icon: Languages },
] as const;

function AskAi({ text }: { text: string }) {
  const openTool = useApp((s) => s.openTool);
  return (
    <Row gap={1}>
      <span className={styles.askLabel}>Ask AI</span>
      {AI_ACTIONS.map(({ tool, label, icon }) => (
        <Chip
          key={tool}
          icon={icon}
          onClick={() => {
            handoff.put(`${tool}:input`, { text, run: true } satisfies AiHandoff);
            openTool(tool);
          }}
        >
          {label}
        </Chip>
      ))}
    </Row>
  );
}

// "Keep lines" first and default: dev content (code, logs, terminals) is line-based.
const LAYOUTS = [
  { value: "lines", label: "Keep lines" },
  { value: "paragraphs", label: "Paragraphs" },
] as const;

export default function Ocr({ autoRun }: ToolProps) {
  const [status, setStatus] = useState<OcrStatus | null>(null);
  const [lang, setLang] = usePersistentState("ocr", "lang", "eng");
  const [layout, setLayout] = usePersistentState<Layout>("ocr", "layout", "lines");
  const [image, setImage] = useState<{ bytes: Uint8Array; url: string } | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"capture" | "ocr" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-query whenever the dependency check re-runs (e.g. "Re-check" after installing).
  const depStatus = useDeps((s) => s.status);
  // biome-ignore lint/correctness/useExhaustiveDependencies: depStatus is an intentional re-run trigger
  useEffect(() => {
    void commands.ocrStatus().then(setStatus);
  }, [depStatus]);

  const run = useCallback(async (bytes: Uint8Array, language: string) => {
    setBusy("ocr");
    setError(null);
    try {
      setRaw(await commands.ocrImage(bytes, language));
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadImage = useCallback(
    (bytes: Uint8Array) => {
      setImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { bytes, url: URL.createObjectURL(new Blob([new Uint8Array(bytes)])) };
      });
      void run(bytes, lang);
    },
    [run, lang],
  );

  const snip = useSnip();

  /** Select an area in Burrow's fullscreen overlay; releasing the mouse reads it. */
  const capture = useCallback(async () => {
    setBusy("capture");
    try {
      const result = await snip.start({ withActions: false });
      if (result) {
        loadImage(result.bytes);
      } else {
        setBusy(null);
        if (autoRun) await commands.hideLauncher();
      }
    } catch (err) {
      setBusy(null);
      if (!isCancelled(err)) setError(String(err));
    }
  }, [snip.start, loadImage, autoRun]);

  // Hand-off from the screenshot editor, or auto-capture from a hotkey — once.
  const started = useRef(false);
  useEffect(() => {
    if (!status?.available || started.current) return;
    started.current = true;
    const handed = handoff.take<Uint8Array>("ocr:image");
    if (handed) loadImage(handed);
    else if (autoRun) void capture();
  }, [status, autoRun, capture, loadImage]);

  useImageInput(
    useCallback(
      async (file: File) => loadImage(new Uint8Array(await file.arrayBuffer())),
      [loadImage],
    ),
  );

  // Re-format whenever the raw result or layout changes (user edits are replaced).
  useEffect(() => {
    if (raw !== null) setText(cleanOcrText(raw, layout));
  }, [raw, layout]);

  if (status && !status.available) {
    return (
      <EmptyState title="Tesseract isn't installed" mood="oops">
        OCR runs locally with Tesseract. Install it with the command above, then press Re-check.
      </EmptyState>
    );
  }

  const options = languageOptions(status?.languages ?? []);

  return (
    <Stack gap={3} grow>
      <Row gap={2}>
        <Button variant="primary" icon={Camera} onClick={capture} disabled={busy !== null}>
          Capture area
        </Button>
        <FilePicker
          accept="image/*"
          label="Open image"
          onFile={async (f) => loadImage(new Uint8Array(await f.arrayBuffer()))}
        />
        <span className="b-grow" />
        {options.length > 0 && (
          <Select
            aria-label="Language"
            className={styles.lang}
            value={lang}
            onChange={(e) => {
              setLang(e.target.value);
              if (image) void run(image.bytes, e.target.value);
            }}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        <Segmented label="Layout" value={layout} options={LAYOUTS} onChange={setLayout} />
      </Row>

      {error && <ErrorNote>{error}</ErrorNote>}
      {snip.overlay}

      {!image && !busy ? (
        <EmptyState title="Grab text from anything on screen" mood="curious">
          Drag over any text on screen, open an image, or paste one with <Kbd>Ctrl</Kbd>{" "}
          <Kbd>V</Kbd>. Everything stays on your machine.
        </EmptyState>
      ) : (
        <div className={styles.split}>
          <Stack gap={2}>
            <PaneLabel label="Image" />
            <div className={styles.preview}>
              {image && <img src={image.url} alt="Captured area" />}
            </div>
          </Stack>
          <Stack gap={2}>
            <PaneLabel
              label="Text"
              aside={
                busy === "ocr" ? (
                  <Tag tone="butter">reading…</Tag>
                ) : text ? (
                  <Row gap={2}>
                    <span>{wordCount(text)} words</span>
                    <CopyButton value={text} size="sm" />
                  </Row>
                ) : null
              }
            />
            <TextArea
              className="b-grow"
              aria-label="Recognised text"
              value={busy === "ocr" ? "" : text}
              placeholder={
                busy === "ocr"
                  ? "Reading text…"
                  : busy === "capture"
                    ? "Waiting for capture…"
                    : "No text found."
              }
              onChange={(e) => setText(e.target.value)}
            />
            {text && busy !== "ocr" && <AskAi text={text} />}
          </Stack>
        </div>
      )}
    </Stack>
  );
}
