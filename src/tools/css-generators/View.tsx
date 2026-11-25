import { Segmented, Stack } from "@/design";
import { useState } from "react";
import { BezierPanel } from "./BezierPanel";
import { BoxShadowPanel } from "./BoxShadowPanel";
import { GradientPanel } from "./GradientPanel";

/** Add a generator: write a <XPanel/> using GeneratorFrame and list it here. */
const GENERATORS = {
  shadow: { label: "Box shadow", Panel: BoxShadowPanel },
  gradient: { label: "Gradient", Panel: GradientPanel },
  bezier: { label: "Cubic bezier", Panel: BezierPanel },
} as const;

type GeneratorId = keyof typeof GENERATORS;

const OPTIONS = (Object.keys(GENERATORS) as GeneratorId[]).map((value) => ({
  value,
  label: GENERATORS[value].label,
}));

export default function CssGenerators() {
  const [active, setActive] = useState<GeneratorId>("shadow");
  const { Panel } = GENERATORS[active];
  return (
    <Stack gap={4}>
      <Segmented label="Generator" value={active} options={OPTIONS} onChange={setActive} />
      <Panel />
    </Stack>
  );
}
