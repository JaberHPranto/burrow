/** Geometry for the fullscreen selection overlay. Pure and unit-tested. */

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Fit {
  /** Screen (CSS) pixels per image pixel. 0.5 on a 2× HiDPI display. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit an image inside a viewport, centred, preserving aspect ratio. */
export function containFit(imageW: number, imageH: number, viewW: number, viewH: number): Fit {
  if (imageW <= 0 || imageH <= 0 || viewW <= 0 || viewH <= 0)
    return { scale: 1, offsetX: 0, offsetY: 0 };
  const scale = Math.min(viewW / imageW, viewH / imageH);
  return { scale, offsetX: (viewW - imageW * scale) / 2, offsetY: (viewH - imageH * scale) / 2 };
}

export function boxFromPoints(a: Pt, b: Pt): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

/** Convert a selection in view pixels to whole image pixels, clamped to the image. */
export function viewBoxToImage(box: Box, fit: Fit, imageW: number, imageH: number): Box {
  const x0 = Math.max(0, Math.round((box.x - fit.offsetX) / fit.scale));
  const y0 = Math.max(0, Math.round((box.y - fit.offsetY) / fit.scale));
  const x1 = Math.min(imageW, Math.round((box.x + box.w - fit.offsetX) / fit.scale));
  const y1 = Math.min(imageH, Math.round((box.y + box.h - fit.offsetY) / fit.scale));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** The image's own area in view pixels (used for "select everything"). */
export function imageViewBox(imageW: number, imageH: number, fit: Fit): Box {
  return { x: fit.offsetX, y: fit.offsetY, w: imageW * fit.scale, h: imageH * fit.scale };
}

/**
 * Where to put the action bar: below the selection if it fits, else above,
 * else inside the selection's bottom edge. Always kept on screen.
 */
export function actionBarPosition(
  sel: Box,
  barW: number,
  barH: number,
  viewW: number,
  viewH: number,
  gap = 10,
): Pt {
  const x = Math.min(Math.max(gap, sel.x + sel.w - barW), viewW - barW - gap);
  if (sel.y + sel.h + gap + barH <= viewH - gap) return { x, y: sel.y + sel.h + gap };
  if (sel.y - gap - barH >= gap) return { x, y: sel.y - gap - barH };
  return { x, y: Math.max(gap, sel.y + sel.h - barH - gap) };
}

/** A drag shorter than this (in view pixels) is treated as a click. */
export const MIN_SELECTION = 6;
