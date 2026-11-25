import { Kbd } from "@/design";
import { Check, Copy, Download, PenLine, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./SnipOverlay.module.css";
import {
  type Box,
  MIN_SELECTION,
  type Pt,
  actionBarPosition,
  boxFromPoints,
  containFit,
  imageViewBox,
  viewBoxToImage,
} from "./geometry";

export type SnipAction = "copy" | "save" | "annotate";

interface SnipOverlayProps {
  /** One monitor's screenshot at full (physical) resolution. */
  image: ImageBitmap;
  /** Shown when there are several monitors; Tab calls onNextMonitor. */
  monitor: { index: number; count: number } | null;
  onNextMonitor: () => void;
  /** Show Copy / Save / Annotate after selecting. Without it, releasing the mouse confirms. */
  withActions: boolean;
  onDone: (box: Box, action: SnipAction | null) => void;
  onCancel: () => void;
}

const BAR_W = 330;
const BAR_H = 44;

export function SnipOverlay({
  image,
  withActions,
  monitor,
  onNextMonitor,
  onDone,
  onCancel,
}: SnipOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [drag, setDrag] = useState<{ start: Pt; current: Pt } | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const fit = containFit(image.width, image.height, view.w, view.h);
  const live = drag ? boxFromPoints(drag.start, drag.current) : selection;
  const imageBox = live ? viewBoxToImage(live, fit, image.width, image.height) : null;

  function confirm(action: SnipAction | null, box: Box | null = selection) {
    if (!box) return;
    const region = viewBoxToImage(box, fit, image.width, image.height);
    if (region.w > 0 && region.h > 0) onDone(region, action);
  }

  function selectAll() {
    const all = imageViewBox(image.width, image.height, fit);
    if (withActions) setSelection(all);
    else confirm(null, all);
  }

  // Keyboard: capture phase so Esc never reaches the tool host behind us.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let handled = true;
      if (e.key === "Escape") onCancel();
      else if (e.key === "Tab" && monitor) onNextMonitor();
      else if (e.key === " ") selectAll();
      else if (selection && withActions && (e.key === "Enter" || (mod && key === "c")))
        confirm("copy");
      else if (selection && withActions && mod && key === "s") confirm("save");
      else if (selection && withActions && key === "e") confirm("annotate");
      else if (selection && !withActions && e.key === "Enter") confirm(null);
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => rootRef.current?.focus(), []);

  // Draw at device-pixel resolution so the screenshot is shown 1:1 (sharp on HiDPI).
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      fit.offsetX,
      fit.offsetY,
      image.width * fit.scale,
      image.height * fit.scale,
    );
  }, [image, view, fit.offsetX, fit.offsetY, fit.scale]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelection(null);
    setDrag({ start: { x: e.clientX, y: e.clientY }, current: { x: e.clientX, y: e.clientY } });
  }

  function onPointerUp() {
    if (!drag) return;
    const box = boxFromPoints(drag.start, drag.current);
    setDrag(null);
    if (box.w < MIN_SELECTION || box.h < MIN_SELECTION) return;
    if (withActions) setSelection(box);
    else confirm(null, box);
  }

  const bar =
    selection && withActions ? actionBarPosition(selection, BAR_W, BAR_H, view.w, view.h) : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => drag && setDrag({ ...drag, current: { x: e.clientX, y: e.clientY } })}
      onPointerUp={onPointerUp}
      onDoubleClick={selectAll}
    >
      <canvas ref={canvasRef} className={styles.canvas} />

      {live ? (
        <div
          className={styles.selection}
          style={{ left: live.x, top: live.y, width: live.w, height: live.h }}
        >
          {imageBox && (
            <span className={styles.size}>
              {imageBox.w} × {imageBox.h}
            </span>
          )}
        </div>
      ) : (
        <div className={styles.dim} />
      )}

      {!live && (
        <div className={styles.hint}>
          Drag to select · <Kbd>Space</Kbd> whole screen
          {monitor && (
            <>
              {" "}
              · <Kbd>Tab</Kbd> monitor {monitor.index + 1}/{monitor.count}
            </>
          )}{" "}
          · <Kbd>Esc</Kbd> cancel
        </div>
      )}

      {bar && (
        <div
          className={styles.bar}
          style={{ left: bar.x, top: bar.y, width: BAR_W }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.primary}
            onClick={() => confirm("copy")}
            title="Copy (Enter)"
          >
            <Copy aria-hidden /> Copy
          </button>
          <button type="button" onClick={() => confirm("save")} title="Save (Ctrl+S)">
            <Download aria-hidden /> Save
          </button>
          <button type="button" onClick={() => confirm("annotate")} title="Annotate (E)">
            <PenLine aria-hidden /> Annotate
          </button>
          <button
            type="button"
            className={styles.icon}
            onClick={onCancel}
            aria-label="Cancel (Esc)"
            title="Cancel (Esc)"
          >
            <X aria-hidden />
          </button>
        </div>
      )}

      {selection && !withActions && (
        <div
          className={styles.bar}
          style={{ left: selection.x, top: selection.y + selection.h + 10 }}
        >
          <button type="button" className={styles.primary} onClick={() => confirm(null)}>
            <Check aria-hidden /> Use selection
          </button>
        </div>
      )}
    </div>
  );
}
