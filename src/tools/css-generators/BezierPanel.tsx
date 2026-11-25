import { Chip, Field, Row, Slider, Stack } from "@/design";
import { useState } from "react";
import { GeneratorFrame } from "./GeneratorFrame";
import { BEZIER_PRESETS, type Bezier, bezierPath, buildBezier } from "./logic";
import styles from "./styles.module.css";

const SIZE = 180;
const PAD = 30;

const HANDLES = [
  { index: 0, label: "x1", min: 0, max: 1 },
  { index: 1, label: "y1", min: -1, max: 2 },
  { index: 2, label: "x2", min: 0, max: 1 },
  { index: 3, label: "y2", min: -1, max: 2 },
] as const;

export function BezierPanel() {
  const [curve, setCurve] = useState<Bezier>([0.2, 0.8, 0.2, 1]);
  const [playKey, setPlayKey] = useState(0);
  const css = buildBezier(curve);
  const inner = SIZE - PAD * 2;
  const point = (x: number, y: number) => ({ cx: PAD + x * inner, cy: PAD + (1 - y) * inner });
  const p1 = point(curve[0], curve[1]);
  const p2 = point(curve[2], curve[3]);

  return (
    <GeneratorFrame
      css={`transition-timing-function: ${css};`}
      preview={
        <Stack gap={3} style={{ alignItems: "center" }}>
          <svg
            width={SIZE}
            height={SIZE}
            className={styles.bezierSvg}
            role="img"
            aria-label="Curve preview"
          >
            <rect x={PAD} y={PAD} width={inner} height={inner} className={styles.bezierGrid} />
            <line x1={PAD} y1={PAD + inner} x2={p1.cx} y2={p1.cy} className={styles.bezierArm} />
            <line x1={PAD + inner} y1={PAD} x2={p2.cx} y2={p2.cy} className={styles.bezierArm} />
            <path d={bezierPath(curve, SIZE, PAD)} className={styles.bezierCurve} />
            <circle {...p1} r={5} className={styles.bezierHandle} />
            <circle {...p2} r={5} className={styles.bezierHandle} />
          </svg>
          <button
            type="button"
            className={styles.track}
            onClick={() => setPlayKey((k) => k + 1)}
            title="Click to replay"
          >
            <span key={playKey} className={styles.ball} style={{ animationTimingFunction: css }} />
          </button>
        </Stack>
      }
    >
      <Row gap={1} style={{ flexWrap: "wrap" }}>
        {BEZIER_PRESETS.map((p) => (
          <Chip
            key={p.name}
            active={p.value.join() === curve.join()}
            onClick={() => {
              setCurve(p.value);
              setPlayKey((k) => k + 1);
            }}
          >
            {p.name}
          </Chip>
        ))}
      </Row>
      {HANDLES.map(({ index, label, min, max }) => (
        <Field key={label} label={label} aside={curve[index].toFixed(2)}>
          <Slider
            label={label}
            min={min}
            max={max}
            step={0.01}
            value={curve[index]}
            onChange={(v) =>
              setCurve((c) => {
                const next: [number, number, number, number] = [...c];
                next[index] = v;
                return next;
              })
            }
          />
        </Field>
      ))}
    </GeneratorFrame>
  );
}
