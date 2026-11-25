/**
 * Annotation document model: shapes + crop, with undo/redo history.
 * All coordinates are in image pixels. Pure — no DOM, fully unit-tested.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Base {
  id: string;
  color: string;
  /** Line width in image pixels (also scales text/step size). */
  stroke: number;
}

export type BoxKind = "rect" | "ellipse" | "highlight" | "blur";

export type Shape =
  | (Base & { kind: "arrow"; from: Point; to: Point })
  | (Base & { kind: BoxKind } & Rect)
  | (Base & { kind: "text"; x: number; y: number; text: string; size: number })
  | (Base & { kind: "step"; x: number; y: number; n: number; size: number });

export type ShapeKind = Shape["kind"];

export interface Doc {
  shapes: Shape[];
  crop: Rect | null;
}

export interface History {
  past: Doc[];
  present: Doc;
  future: Doc[];
}

export type Action =
  | { type: "add"; shape: Shape }
  | { type: "update"; id: string; patch: Partial<Shape> }
  | { type: "move"; id: string; dx: number; dy: number }
  | { type: "remove"; id: string }
  | { type: "crop"; rect: Rect | null }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" };

export const EMPTY_DOC: Doc = { shapes: [], crop: null };
export const initialHistory = (): History => ({ past: [], present: EMPTY_DOC, future: [] });

const MAX_HISTORY = 100;

function apply(doc: Doc, action: Action): Doc {
  switch (action.type) {
    case "add":
      return { ...doc, shapes: [...doc.shapes, action.shape] };
    case "update":
      return {
        ...doc,
        shapes: doc.shapes.map((s) =>
          s.id === action.id ? ({ ...s, ...action.patch } as Shape) : s,
        ),
      };
    case "move":
      return {
        ...doc,
        shapes: doc.shapes.map((s) =>
          s.id === action.id ? moveShape(s, action.dx, action.dy) : s,
        ),
      };
    case "remove":
      return { ...doc, shapes: doc.shapes.filter((s) => s.id !== action.id) };
    case "crop":
      return { ...doc, crop: action.rect };
    case "clear":
      return EMPTY_DOC;
    default:
      return doc;
  }
}

export function historyReducer(h: History, action: Action): History {
  switch (action.type) {
    case "undo": {
      const prev = h.past.at(-1);
      return prev
        ? { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] }
        : h;
    }
    case "redo": {
      const [next, ...rest] = h.future;
      return next ? { past: [...h.past, h.present], present: next, future: rest } : h;
    }
    default: {
      const present = apply(h.present, action);
      if (present === h.present) return h;
      return { past: [...h.past, h.present].slice(-MAX_HISTORY), present, future: [] };
    }
  }
}

/* ---------------- Geometry ---------------- */

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

export function clampRect(r: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(r.x, width));
  const y = Math.max(0, Math.min(r.y, height));
  return {
    x,
    y,
    w: Math.max(0, Math.min(r.x + r.w, width) - x),
    h: Math.max(0, Math.min(r.y + r.h, height) - y),
  };
}

export function moveShape(s: Shape, dx: number, dy: number): Shape {
  if (s.kind === "arrow") {
    return {
      ...s,
      from: { x: s.from.x + dx, y: s.from.y + dy },
      to: { x: s.to.x + dx, y: s.to.y + dy },
    };
  }
  return { ...s, x: s.x + dx, y: s.y + dy };
}

/** Approximate text width without a canvas (good enough for hit-testing). */
export const textWidth = (text: string, size: number) => text.length * size * 0.58;

export function shapeBounds(s: Shape): Rect {
  switch (s.kind) {
    case "arrow":
      return normalizeRect(s.from, s.to);
    case "text":
      return { x: s.x, y: s.y - s.size, w: textWidth(s.text, s.size), h: s.size * 1.25 };
    case "step":
      return { x: s.x - s.size, y: s.y - s.size, w: s.size * 2, h: s.size * 2 };
    default:
      return { x: s.x, y: s.y, w: s.w, h: s.h };
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Does point `p` hit shape `s`? `tolerance` in image pixels. */
export function hitTest(s: Shape, p: Point, tolerance: number): boolean {
  switch (s.kind) {
    case "arrow":
      return distanceToSegment(p, s.from, s.to) <= tolerance + s.stroke / 2;
    case "step":
      return Math.hypot(p.x - s.x, p.y - s.y) <= s.size + tolerance;
    case "ellipse": {
      const rx = s.w / 2 + tolerance;
      const ry = s.h / 2 + tolerance;
      if (rx <= 0 || ry <= 0) return false;
      const nx = (p.x - (s.x + s.w / 2)) / rx;
      const ny = (p.y - (s.y + s.h / 2)) / ry;
      return nx * nx + ny * ny <= 1;
    }
    default: {
      const b = shapeBounds(s);
      return (
        p.x >= b.x - tolerance &&
        p.x <= b.x + b.w + tolerance &&
        p.y >= b.y - tolerance &&
        p.y <= b.y + b.h + tolerance
      );
    }
  }
}

/** Topmost shape under the point (last drawn wins). */
export function shapeAt(shapes: readonly Shape[], p: Point, tolerance: number): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i] as Shape;
    if (hitTest(s, p, tolerance)) return s;
  }
  return undefined;
}

/** Two points forming the arrow head's barbs. */
export function arrowHead(from: Point, to: Point, size: number): [Point, Point] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ];
}

export const nextStepNumber = (shapes: readonly Shape[]) =>
  shapes.reduce((max, s) => (s.kind === "step" ? Math.max(max, s.n) : max), 0) + 1;

/** Too small to be intentional (a click, not a drag). */
export function isTiny(s: Shape): boolean {
  if (s.kind === "arrow") return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) < 6;
  if (s.kind === "text" || s.kind === "step") return false;
  return s.w < 4 || s.h < 4;
}

/** Scale to fit an image inside a box, never upscaling beyond 1. */
export function fitScale(imageW: number, imageH: number, boxW: number, boxH: number): number {
  if (imageW <= 0 || imageH <= 0 || boxW <= 0 || boxH <= 0) return 1;
  return Math.min(1, boxW / imageW, boxH / imageH);
}

export function timestampedName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `burrow-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.png`;
}
