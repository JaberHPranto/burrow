import { Button, ColorInput, Field, IconButton, Row, Segmented, Slider, Stack } from "@/design";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { GeneratorFrame } from "./GeneratorFrame";
import { type GradientStop, type GradientType, buildGradient } from "./logic";
import styles from "./styles.module.css";

const TYPES = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" },
] as const;

export function GradientPanel() {
  const [type, setType] = useState<GradientType>("linear");
  const [angle, setAngle] = useState(135);
  const [stops, setStops] = useState<GradientStop[]>([
    { color: "#88cca6", position: 0 },
    { color: "#a8dadc", position: 50 },
    { color: "#f8e192", position: 100 },
  ]);
  const css = buildGradient({ type, angle, stops });

  const updateStop = (i: number, patch: Partial<GradientStop>) =>
    setStops((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <GeneratorFrame
      css={`background: ${css};`}
      preview={<div className={styles.gradientBox} style={{ background: css }} />}
    >
      <Segmented label="Gradient type" value={type} options={TYPES} onChange={setType} />
      {type !== "radial" && (
        <Field label="Angle" aside={`${angle}°`}>
          <Slider label="Angle" min={0} max={360} value={angle} onChange={setAngle} />
        </Field>
      )}
      <Stack gap={2}>
        {stops.map((stop, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stops are positional
          <Row key={i} gap={2}>
            <ColorInput
              label={`Stop ${i + 1} colour`}
              className={styles.stopColor}
              value={stop.color}
              onChange={(color) => updateStop(i, { color })}
            />
            <div className="b-grow">
              <Slider
                label={`Stop ${i + 1} position`}
                min={0}
                max={100}
                value={stop.position}
                onChange={(position) => updateStop(i, { position })}
              />
            </div>
            <span className={styles.stopPos}>{stop.position}%</span>
            <IconButton
              icon={X}
              label="Remove stop"
              disabled={stops.length <= 2}
              onClick={() => setStops((ss) => ss.filter((_, j) => j !== i))}
            />
          </Row>
        ))}
      </Stack>
      <Button
        size="sm"
        variant="ghost"
        icon={Plus}
        onClick={() => setStops((ss) => [...ss, { color: "#f28b82", position: 75 }])}
      >
        Add stop
      </Button>
    </GeneratorFrame>
  );
}
