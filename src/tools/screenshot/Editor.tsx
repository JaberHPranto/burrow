import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type Action,
  type History,
  type Point,
  type Shape,
  clampRect,
  fitScale,
  historyReducer,
  initialHistory,
  isTiny,
  moveShape,
  nextStepNumber,
  normalizeRect,
  shapeAt,
} from "./model";
import { drawDoc } from "./render";
import styles from "./styles.module.css";

export type EditorTool =
  | "select"
  | "arrow"
  | "rect"
  | "ellipse"
  | "highlight"
  | "blur"
  | "text"
  | "step"
  | "crop";

export interface LoadedImage {
  el: HTMLImageElement;
  w: number;
  h: number;
}

interface EditorProps {
  image: LoadedImage;
  tool: EditorTool;
  color: string;
  /** Stroke in screen pixels; converted to image pixels so it looks the same at any zoom. */
  stroke: number;
  history: History;
  dispatch: (a: Action) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** After a crop is drawn, return to the select tool. */
  onToolDone: () => void;
}

type Drag =
  | { kind: "draw"; shape: Shape; start: Point }
  | { kind: "move"; id: string; start: Point; current: Point }
  | { kind: "crop"; start: Point; current: Point };

const newId = () => crypto.randomUUID();

export function useEditorHistory() {
  return useReducer(historyReducer, undefined, initialHistory);
}

export function Editor({
  image,
  tool,
  color,
  stroke,
  history,
  dispatch,
  selectedId,
  onSelect,
  onToolDone,
}: EditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [textEntry, setTextEntry] = useState<{ at: Point; value: string } | null>(null);

  const scale = fitScale(image.w, image.h, box.w, box.h);
  const imgStroke = Math.max(1, stroke / scale);
  const doc = history.present;

  // Track the available space.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Live view of the document including the shape being dragged.
  const liveDoc = useMemo(() => {
    if (!drag) return doc;
    if (drag.kind === "draw") return { ...doc, shapes: [...doc.shapes, drag.shape] };
    if (drag.kind === "move") {
      const dx = drag.current.x - drag.start.x;
      const dy = drag.current.y - drag.start.y;
      return {
        ...doc,
        shapes: doc.shapes.map((s) => (s.id === drag.id ? moveShape(s, dx, dy) : s)),
      };
    }
    return { ...doc, crop: clampRect(normalizeRect(drag.start, drag.current), image.w, image.h) };
  }, [doc, drag, image]);

  // Paint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scale <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(image.w * scale);
    const cssH = Math.round(image.h * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawDoc(ctx, image.el, { w: image.w, h: image.h }, liveDoc, {
      selectedId: tool === "select" ? selectedId : null,
      cropOverlay: true,
      viewScale: scale,
    });
  }, [image, scale, liveDoc, selectedId, tool]);

  const toImage = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min(image.w, (e.clientX - rect.left) / scale)),
        y: Math.max(0, Math.min(image.h, (e.clientY - rect.top) / scale)),
      };
    },
    [image, scale],
  );

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 || textEntry) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    const base = { id: newId(), color, stroke: imgStroke };

    switch (tool) {
      case "select": {
        const hit = shapeAt(doc.shapes, p, 6 / scale);
        onSelect(hit?.id ?? null);
        if (hit) setDrag({ kind: "move", id: hit.id, start: p, current: p });
        return;
      }
      case "crop":
        setDrag({ kind: "crop", start: p, current: p });
        return;
      case "text":
        // Keep the click from stealing focus back from the text box we're about to open.
        e.preventDefault();
        setTextEntry({ at: p, value: "" });
        return;
      case "step":
        dispatch({
          type: "add",
          shape: {
            ...base,
            kind: "step",
            x: p.x,
            y: p.y,
            n: nextStepNumber(doc.shapes),
            size: imgStroke * 4 + 8 / scale,
          },
        });
        return;
      case "arrow":
        setDrag({ kind: "draw", start: p, shape: { ...base, kind: "arrow", from: p, to: p } });
        return;
      default:
        setDrag({
          kind: "draw",
          start: p,
          shape: { ...base, kind: tool, x: p.x, y: p.y, w: 0, h: 0 },
        });
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag) {
      // Cursor feedback in select mode.
      if (tool === "select") {
        const over = shapeAt(doc.shapes, toImage(e), 6 / scale);
        e.currentTarget.style.cursor = over ? "move" : "default";
      }
      return;
    }
    const p = toImage(e);
    if (drag.kind === "draw") {
      const s = drag.shape;
      const shape: Shape =
        s.kind === "arrow" ? { ...s, to: p } : ({ ...s, ...normalizeRect(drag.start, p) } as Shape);
      setDrag({ ...drag, shape });
    } else {
      setDrag({ ...drag, current: p });
    }
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.kind === "draw" && !isTiny(drag.shape)) {
      dispatch({ type: "add", shape: drag.shape });
    } else if (drag.kind === "move") {
      const dx = drag.current.x - drag.start.x;
      const dy = drag.current.y - drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) dispatch({ type: "move", id: drag.id, dx, dy });
    } else if (drag.kind === "crop") {
      const r = clampRect(normalizeRect(drag.start, drag.current), image.w, image.h);
      dispatch({ type: "crop", rect: r.w > 8 && r.h > 8 ? r : null });
      onToolDone();
    }
    setDrag(null);
  }

  function commitText() {
    if (textEntry?.value.trim()) {
      dispatch({
        type: "add",
        shape: {
          id: newId(),
          kind: "text",
          color,
          stroke: imgStroke,
          x: textEntry.at.x,
          y: textEntry.at.y,
          text: textEntry.value.trim(),
          size: Math.max(14, imgStroke * 7),
        },
      });
    }
    setTextEntry(null);
  }

  return (
    <div ref={wrapRef} className={styles.stage}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          data-tool={tool}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        />
        {textEntry && (
          <input
            className={styles.textEntry}
            style={{
              left: textEntry.at.x * scale,
              top: textEntry.at.y * scale - Math.max(14, imgStroke * 7) * scale,
              color,
              fontSize: Math.max(14, imgStroke * 7) * scale,
            }}
            value={textEntry.value}
            placeholder="Type, then Enter"
            onChange={(e) => setTextEntry({ ...textEntry, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") {
                e.preventDefault();
                setTextEntry(null);
              }
              e.stopPropagation();
            }}
            onBlur={commitText}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}
