import { useApp } from "@/app/store";
import { decodeImage } from "@/core/capture/image";
import { useSnip } from "@/core/capture/useSnip";
import { handoff } from "@/core/handoff";
import { useImageInput } from "@/core/hooks/useImageInput";
import { clipboard } from "@/core/platform/clipboard";
import { commands, isCancelled } from "@/core/platform/commands";
import { useWindowSize } from "@/core/platform/window";
import type { ToolProps } from "@/core/tools/types";
import { cx } from "@/core/utils/cx";
import { Button, EmptyState, FilePicker, IconButton, Kbd, Row, toast } from "@/design";
import {
  ArrowUpRight,
  Camera,
  Circle,
  Copy,
  Crop,
  Download,
  Grid2x2,
  Highlighter,
  ListOrdered,
  MousePointer2,
  Redo2,
  ScanText,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, type EditorTool, type LoadedImage, useEditorHistory } from "./Editor";
import { timestampedName } from "./model";
import { exportPng } from "./render";
import styles from "./styles.module.css";

const TOOLS: ReadonlyArray<{ id: EditorTool; label: string; key: string; icon: typeof Square }> = [
  { id: "select", label: "Select & move", key: "v", icon: MousePointer2 },
  { id: "arrow", label: "Arrow", key: "a", icon: ArrowUpRight },
  { id: "rect", label: "Box", key: "r", icon: Square },
  { id: "ellipse", label: "Ellipse", key: "e", icon: Circle },
  { id: "highlight", label: "Highlight", key: "h", icon: Highlighter },
  { id: "blur", label: "Pixelate (hide secrets)", key: "b", icon: Grid2x2 },
  { id: "text", label: "Text", key: "t", icon: Type },
  { id: "step", label: "Numbered step", key: "n", icon: ListOrdered },
  { id: "crop", label: "Crop", key: "c", icon: Crop },
];

const COLORS = ["#f28b82", "#f8e192", "#88cca6", "#a8dadc", "#ffffff", "#181a20"];
const STROKES = [
  { value: 2, label: "S" },
  { value: 4, label: "M" },
  { value: 7, label: "L" },
];

/** Hand-off key other tools can use to open an image here. */
const SCREENSHOT_HANDOFF = "screenshot:image";

export default function Screenshot({ autoRun }: ToolProps) {
  const openTool = useApp((s) => s.openTool);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [history, dispatch] = useEditorHistory();
  const [tool, setTool] = useState<EditorTool>("arrow");
  const [color, setColor] = useState(COLORS[0] as string);
  const [stroke, setStroke] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useWindowSize(1100, 740, image !== null);

  const load = useCallback(
    async (bytes: Uint8Array) => {
      const el = await decodeImage(bytes);
      setImage({ el, w: el.naturalWidth, h: el.naturalHeight });
      dispatch({ type: "clear" });
      setSelectedId(null);
    },
    [dispatch],
  );

  const snip = useSnip();

  /**
   * Grab the screen → select a region in Burrow's fullscreen overlay → then
   * copy, save, or annotate. Copy/Save finish the job and hide Burrow.
   */
  const capture = useCallback(async () => {
    setBusy(true);
    try {
      const result = await snip.start({ withActions: true });
      if (!result) {
        // Cancelled. If a hotkey opened us, go back to being invisible.
        if (autoRun) await commands.hideLauncher();
        return;
      }
      if (result.action === "annotate") {
        await load(result.bytes);
        return;
      }
      if (result.action === "copy") {
        await clipboard.writeImage(result.bytes);
        toast.success("Screenshot copied");
      } else if (result.action === "save") {
        const path = await commands.savePng(result.bytes, timestampedName());
        if (!path) return; // save dialog cancelled: stay so they can choose again
        toast.success(`Saved ${path.split("/").pop()}`);
      }
      await commands.hideLauncher();
    } catch (err) {
      if (!isCancelled(err)) toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }, [snip.start, load, autoRun]);

  // Opened via hotkey/tray with --run → capture straight away. Or an image was handed over.
  // The ref guard stops React StrictMode's double effect from opening two portal dialogs.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const handed = handoff.take<Uint8Array>(SCREENSHOT_HANDOFF);
    if (handed) void load(handed);
    else if (autoRun) void capture();
  }, [autoRun, capture, load]);

  useImageInput(
    useCallback(async (file: File) => load(new Uint8Array(await file.arrayBuffer())), [load]),
  );

  const render = useCallback(async () => {
    if (!image) throw new Error("No image");
    return exportPng(image.el, { w: image.w, h: image.h }, history.present);
  }, [image, history.present]);

  const copy = useCallback(async () => {
    try {
      await clipboard.writeImage(await render());
      toast.success("Image copied");
    } catch (err) {
      toast.error(`Couldn't copy: ${String(err)}`);
    }
  }, [render]);

  const save = useCallback(async () => {
    try {
      const path = await commands.savePng(await render(), timestampedName());
      if (path) toast.success(`Saved ${path.split("/").pop()}`);
    } catch (err) {
      toast.error(`Couldn't save: ${String(err)}`);
    }
  }, [render]);

  const sendToOcr = useCallback(async () => {
    handoff.put("ocr:image", await render());
    openTool("ocr");
  }, [render, openTool]);

  // Keyboard shortcuts (inactive while typing in an input).
  useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && key === "c") {
        e.preventDefault();
        void copy();
      } else if (mod && key === "s") {
        e.preventDefault();
        void save();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        dispatch({ type: "remove", id: selectedId });
        setSelectedId(null);
      } else if (e.key === "Escape" && (selectedId || tool !== "select")) {
        e.preventDefault(); // first Esc deselects; ToolHost handles the next one
        setSelectedId(null);
        setTool("select");
      } else if (!mod && !e.altKey) {
        const t = TOOLS.find((x) => x.key === key);
        if (t) setTool(t.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, selectedId, tool, copy, save, dispatch]);

  // Changing colour/size while a shape is selected restyles it.
  function applyStyle(patch: { color?: string }) {
    if (selectedId && tool === "select") dispatch({ type: "update", id: selectedId, patch });
  }

  if (!image) {
    return (
      <EmptyState
        title={busy ? "Select an area…" : "Capture something"}
        mood={busy ? "sleepy" : "curious"}
        action={
          <Row gap={2}>
            <Button variant="primary" icon={Camera} onClick={capture} disabled={busy}>
              Capture screen
            </Button>
            <FilePicker
              accept="image/*"
              label="Open image"
              onFile={async (f) => load(new Uint8Array(await f.arrayBuffer()))}
            />
          </Row>
        }
      >
        Drag over any part of the screen, then copy, save or annotate it. You can also paste (
        <Kbd>Ctrl</Kbd> <Kbd>V</Kbd>) or drop an image here.
        {snip.overlay}
      </EmptyState>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.toolbar} role="toolbar" aria-label="Annotation tools">
        <div className={styles.group}>
          {TOOLS.map(({ id, label, key, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={cx(styles.toolBtn, tool === id && styles.toolActive)}
              aria-pressed={tool === id}
              title={`${label} (${key.toUpperCase()})`}
              aria-label={label}
              onClick={() => {
                setTool(id);
                if (id !== "select") setSelectedId(null);
              }}
            >
              <Icon aria-hidden />
            </button>
          ))}
        </div>

        <div className={styles.group}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={cx(styles.swatch, color === c && styles.swatchActive)}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => {
                setColor(c);
                applyStyle({ color: c });
              }}
            />
          ))}
        </div>

        <div className={styles.group}>
          {STROKES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={cx(styles.sizeBtn, stroke === s.value && styles.toolActive)}
              aria-pressed={stroke === s.value}
              title={`Size ${s.label}`}
              onClick={() => setStroke(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          <IconButton
            icon={Undo2}
            label="Undo (Ctrl+Z)"
            onClick={() => dispatch({ type: "undo" })}
            disabled={!history.past.length}
          />
          <IconButton
            icon={Redo2}
            label="Redo (Ctrl+Shift+Z)"
            onClick={() => dispatch({ type: "redo" })}
            disabled={!history.future.length}
          />
          {selectedId && (
            <IconButton
              icon={Trash2}
              label="Delete selected (Del)"
              onClick={() => {
                dispatch({ type: "remove", id: selectedId });
                setSelectedId(null);
              }}
            />
          )}
        </div>

        <span className="b-grow" />

        <Row gap={2}>
          <IconButton icon={Camera} label="New capture" onClick={capture} />
          <Button size="sm" icon={ScanText} onClick={sendToOcr}>
            OCR
          </Button>
          <Button size="sm" icon={Download} onClick={save}>
            Save
          </Button>
          <Button size="sm" variant="primary" icon={Copy} onClick={copy}>
            Copy
          </Button>
        </Row>
      </div>

      <Editor
        image={image}
        tool={tool}
        color={color}
        stroke={stroke}
        history={history}
        dispatch={dispatch}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onToolDone={() => setTool("select")}
      />

      {snip.overlay}

      <div className={styles.status}>
        <span>
          {history.present.crop
            ? `${Math.round(history.present.crop.w)} × ${Math.round(history.present.crop.h)} (cropped)`
            : `${image.w} × ${image.h}`}
        </span>
        {history.present.crop && (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => dispatch({ type: "crop", rect: null })}
          >
            Remove crop
          </button>
        )}
        <span className="b-grow" />
        <span>
          <Kbd>Ctrl</Kbd> <Kbd>C</Kbd> copy · <Kbd>Ctrl</Kbd> <Kbd>S</Kbd> save · <Kbd>Del</Kbd>{" "}
          delete
        </span>
      </div>
    </div>
  );
}
