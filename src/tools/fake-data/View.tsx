import { Button, CodeBlock, CopyButton, Field, Row, Select, Slider, Stack } from "@/design";
import { Dices } from "lucide-react";
import { useMemo, useState } from "react";
import { FAKE_KINDS, type FakeKind, createRng, generate } from "./logic";

const DEFAULT_COUNT: Record<FakeKind, number> = {
  paragraphs: 3,
  sentences: 5,
  words: 30,
  people: 5,
  names: 10,
  emails: 10,
  uuids: 10,
};

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function FakeData() {
  const [kind, setKind] = useState<FakeKind>("paragraphs");
  const [count, setCount] = useState(DEFAULT_COUNT.paragraphs);
  const [seed, setSeed] = useState(newSeed);

  const output = useMemo(() => generate(kind, count, createRng(seed)), [kind, count, seed]);
  const max = kind === "words" ? 300 : 50;

  return (
    <Stack gap={3} grow>
      <Row gap={3} style={{ alignItems: "flex-end" }}>
        <Field label="Type" className="b-grow">
          <Select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as FakeKind;
              setKind(next);
              setCount(DEFAULT_COUNT[next]);
            }}
          >
            {FAKE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Count" aside={count} className="b-grow">
          <Slider
            label="Count"
            min={1}
            max={max}
            value={Math.min(count, max)}
            onChange={setCount}
          />
        </Field>
        <Button icon={Dices} onClick={() => setSeed(newSeed())}>
          Shuffle
        </Button>
        <CopyButton value={output} />
      </Row>
      <CodeBlock className="b-grow">{output}</CodeBlock>
    </Stack>
  );
}
