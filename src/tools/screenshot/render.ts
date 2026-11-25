/**
 * Canvas rendering for the annotation editor. The same `drawDoc` is used for
 * the on-screen view and for export, so what you see is what you copy/save.
 */
import { parseColor, readableOn } from "@/core/color/color";
import { type Doc, type Rect, type Shape, arrowHead, shapeBounds } from "./model";

const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", sans-serif';
const PIXEL_BLOCK = 12;

export interface DrawOptions {
  /** Highlight this shape with a dashed outline (view only). */
  selectedId?: string | null;
  /** Show the crop as a dimmed overlay instead of applying it (view only). */
  cropOverlay?: boolean;
  /** Pixels-per-image-pixel of the view, so UI chrome stays a constant screen size. */
  viewScale?: number;
}

function pixelate(ctx: CanvasRenderingContext2D, image: CanvasImageSource, r: Rect) {
  if (r.w < 1 || r.h < 1) return;
  const tw = Math.max(1, Math.round(r.w / PIXEL_BLOCK));
  const th = Math.max(1, Math.round(r.h / PIXEL_BLOCK));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  tmp.getContext("2d")?.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, tw, th);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tw, th, r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (s.kind) {
    case "rect":
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, s.w, s.h, Math.min(6, s.stroke * 1.5));
      ctx.stroke();
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "highlight":
      ctx.globalAlpha = 0.35;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      break;
    case "arrow": {
      const head = Math.max(12, s.stroke * 4);
      const [a, b] = arrowHead(s.from, s.to, head);
      // Stop the shaft short of the tip so the round cap doesn't poke through the head.
      const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) || 1;
      const k = Math.max(0, (len - head * 0.6) / len);
      ctx.beginPath();
      ctx.moveTo(s.from.x, s.from.y);
      ctx.lineTo(s.from.x + (s.to.x - s.from.x) * k, s.from.y + (s.to.y - s.from.y) * k);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.to.x, s.to.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "text": {
      ctx.font = `700 ${s.size}px ${FONT}`;
      ctx.textBaseline = "alphabetic";
      const rgb = parseColor(s.color);
      ctx.strokeStyle = rgb ? readableOn(rgb) : "#181a20";
      ctx.lineWidth = Math.max(2, s.size / 7);
      ctx.strokeText(s.text, s.x, s.y);
      ctx.fillText(s.text, s.x, s.y);
      break;
    }
    case "step": {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = Math.max(2, s.size / 7);
      ctx.strokeStyle = "#181a20";
      ctx.stroke();
      const rgb = parseColor(s.color);
      ctx.fillStyle = rgb ? readableOn(rgb) : "#181a20";
      ctx.font = `800 ${s.size * 1.1}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.n), s.x, s.y + s.size * 0.06);
      break;
    }
    case "blur":
      break; // drawn in the pixelate pass
  }
  ctx.restore();
}

/** Draw image + annotations at image resolution into `ctx` (caller sets transforms). */
export function drawDoc(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  size: { w: number; h: number },
  doc: Doc,
  opts: DrawOptions = {},
) {
  ctx.drawImage(image, 0, 0, size.w, size.h);

  // Blur first so it only hides the screenshot, never other annotations.
  for (const s of doc.shapes) if (s.kind === "blur") pixelate(ctx, image, s);
  for (const s of doc.shapes) if (s.kind === "highlight") drawShape(ctx, s);
  for (const s of doc.shapes) if (s.kind !== "blur" && s.kind !== "highlight") drawShape(ctx, s);

  const px = 1 / (opts.viewScale ?? 1); // one screen pixel in image pixels

  if (opts.selectedId) {
    const sel = doc.shapes.find((s) => s.id === opts.selectedId);
    if (sel) {
      const b = shapeBounds(sel);
      const pad = 6 * px;
      ctx.save();
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.lineWidth = 1.5 * px;
      ctx.strokeStyle = "#88cca6";
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.restore();
    }
  }

  if (opts.cropOverlay && doc.crop) {
    const c = doc.crop;
    ctx.save();
    ctx.fillStyle = "rgba(10, 11, 14, 0.62)";
    ctx.beginPath();
    ctx.rect(0, 0, size.w, size.h);
    ctx.rect(c.x, c.y, c.w, c.h);
    ctx.fill("evenodd");
    ctx.setLineDash([8 * px, 5 * px]);
    ctx.lineWidth = 2 * px;
    ctx.strokeStyle = "#f8e192";
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.restore();
  }
}

/** Render the final image (crop applied, no selection UI) as PNG bytes. */
export async function exportPng(
  image: CanvasImageSource,
  size: { w: number; h: number },
  doc: Doc,
): Promise<Uint8Array> {
  const crop =
    doc.crop && doc.crop.w >= 1 && doc.crop.h >= 1
      ? doc.crop
      : { x: 0, y: 0, w: size.w, h: size.h };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.w);
  canvas.height = Math.round(crop.h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.translate(-crop.x, -crop.y);
  drawDoc(ctx, image, size, doc);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't encode PNG");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Decode PNG/JPEG bytes into an image element. */
export async function decodeImage(bytes: Uint8Array): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
