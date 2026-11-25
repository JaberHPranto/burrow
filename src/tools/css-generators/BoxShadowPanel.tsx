import { Button, Chip, ColorInput, Field, IconButton, Row, Slider, Stack } from "@/design";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { GeneratorFrame } from "./GeneratorFrame";
import { type ShadowLayer, buildBoxShadow } from "./logic";
import styles from "./styles.module.css";

const NEW_LAYER: ShadowLayer = {
  x: 0,
  y: 8,
  blur: 24,
  spread: -4,
  color: "rgba(0, 0, 0, 0.35)",
  inset: false,
};

const SLIDERS = [
  { key: "x", label: "Offset X", min: -50, max: 50 },
  { key: "y", label: "Offset Y", min: -50, max: 50 },
  { key: "blur", label: "Blur", min: 0, max: 100 },
  { key: "spread", label: "Spread", min: -50, max: 50 },
] as const;

export function BoxShadowPanel() {
  const [layers, setLayers] = useState<ShadowLayer[]>([
    { x: 0, y: 2, blur: 4, spread: 0, color: "rgba(0, 0, 0, 0.25)", inset: false },
    { ...NEW_LAYER },
  ]);
  const [selected, setSelected] = useState(1);
  const layer = layers[selected];
  const css = buildBoxShadow(layers);

  const update = (patch: Partial<ShadowLayer>) =>
    setLayers((ls) => ls.map((l, i) => (i === selected ? { ...l, ...patch } : l)));

  return (
    <GeneratorFrame
      lightStage
      css={`box-shadow: ${css};`}
      preview={<div className={styles.shadowBox} style={{ boxShadow: css }} />}
    >
      <Row gap={1} style={{ flexWrap: "wrap" }}>
        {layers.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: layers are positional
          <Chip key={i} active={i === selected} onClick={() => setSelected(i)}>
            Layer {i + 1}
          </Chip>
        ))}
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onClick={() => {
            setLayers((ls) => [...ls, { ...NEW_LAYER }]);
            setSelected(layers.length);
          }}
        >
          Add
        </Button>
      </Row>

      {layer && (
        <Stack gap={3}>
          {SLIDERS.map(({ key, label, min, max }) => (
            <Field key={key} label={label} aside={`${layer[key]}px`}>
              <Slider
                label={label}
                min={min}
                max={max}
                value={layer[key]}
                onChange={(v) => update({ [key]: v })}
              />
            </Field>
          ))}
          <Field label="Colour">
            <ColorInput
              label="Shadow colour"
              value={layer.color}
              onChange={(color) => update({ color })}
            />
          </Field>
          <Row gap={2}>
            <Chip active={layer.inset} onClick={() => update({ inset: !layer.inset })}>
              Inset
            </Chip>
            <span className="b-grow" />
            <IconButton
              icon={Trash2}
              label="Remove layer"
              disabled={layers.length === 1}
              onClick={() => {
                setLayers((ls) => ls.filter((_, i) => i !== selected));
                setSelected((s) => Math.max(0, s - 1));
              }}
            />
          </Row>
        </Stack>
      )}
    </GeneratorFrame>
  );
}
