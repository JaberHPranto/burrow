/* ---------------- Box shadow ---------------- */

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

const px = (n: number) => (n === 0 ? "0" : `${n}px`);

export function buildBoxShadow(layers: readonly ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers
    .map(
      (l) =>
        `${l.inset ? "inset " : ""}${px(l.x)} ${px(l.y)} ${px(l.blur)} ${px(l.spread)} ${l.color}`,
    )
    .join(",\n    ");
}

/* ---------------- Gradient ---------------- */

export type GradientType = "linear" | "radial" | "conic";

export interface GradientStop {
  color: string;
  /** 0–100 */
  position: number;
}

export interface Gradient {
  type: GradientType;
  /** Degrees, used by linear and conic. */
  angle: number;
  stops: readonly GradientStop[];
}

export function buildGradient({ type, angle, stops }: Gradient): string {
  const list = [...stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  switch (type) {
    case "linear":
      return `linear-gradient(${angle}deg, ${list})`;
    case "radial":
      return `radial-gradient(circle, ${list})`;
    case "conic":
      return `conic-gradient(from ${angle}deg, ${list})`;
  }
}

/* ---------------- Cubic bezier ---------------- */

export type Bezier = readonly [number, number, number, number];

export const BEZIER_PRESETS: ReadonlyArray<{ name: string; value: Bezier }> = [
  { name: "ease", value: [0.25, 0.1, 0.25, 1] },
  { name: "ease-in", value: [0.42, 0, 1, 1] },
  { name: "ease-out", value: [0, 0, 0.58, 1] },
  { name: "ease-in-out", value: [0.42, 0, 0.58, 1] },
  { name: "snappy", value: [0.2, 0.8, 0.2, 1] },
  { name: "back-out", value: [0.34, 1.56, 0.64, 1] },
  { name: "hop", value: [0.68, -0.6, 0.32, 1.6] },
];

const round = (n: number) => Math.round(n * 100) / 100;

export function buildBezier(b: Bezier): string {
  return `cubic-bezier(${b.map(round).join(", ")})`;
}

/**
 * SVG path for the curve inside a `size`×`size` box with `pad` padding.
 * y is flipped so "up" means progress; values outside 0–1 overshoot into the padding.
 */
export function bezierPath(b: Bezier, size: number, pad: number): string {
  const inner = size - pad * 2;
  const pt = (x: number, y: number) => `${round(pad + x * inner)} ${round(pad + (1 - y) * inner)}`;
  return `M ${pt(0, 0)} C ${pt(b[0], b[1])}, ${pt(b[2], b[3])}, ${pt(1, 1)}`;
}
