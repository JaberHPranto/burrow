/** Lorem ipsum and fake records, built on the shared seeded primitives in core/fake. */
import { type Rng, fake } from "@/core/fake/fake";

export { createRng } from "@/core/fake/fake";

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  createdAt: string;
}

export function person(rng: Rng): Person {
  const name = fake.fullName(rng);
  return {
    id: fake.uuid(rng),
    name,
    email: fake.email(rng, name),
    phone: fake.phone(rng),
    company: fake.company(rng),
    address: fake.address(rng),
    createdAt: fake.dateTime(rng),
  };
}

export type FakeKind =
  | "paragraphs"
  | "sentences"
  | "words"
  | "people"
  | "emails"
  | "names"
  | "uuids";

export const FAKE_KINDS: ReadonlyArray<{ value: FakeKind; label: string }> = [
  { value: "paragraphs", label: "Paragraphs" },
  { value: "sentences", label: "Sentences" },
  { value: "words", label: "Words" },
  { value: "people", label: "People (JSON)" },
  { value: "names", label: "Names" },
  { value: "emails", label: "Emails" },
  { value: "uuids", label: "UUIDs" },
];

export function generate(kind: FakeKind, count: number, rng: Rng): string {
  const n = Math.max(1, Math.min(count, 500));
  const many = <T>(fn: () => T) => Array.from({ length: n }, fn);
  switch (kind) {
    case "paragraphs":
      return many(() => fake.paragraph(rng)).join("\n\n");
    case "sentences":
      return many(() => fake.sentence(rng)).join(" ");
    case "words":
      return fake.words(rng, n);
    case "people":
      return JSON.stringify(
        many(() => person(rng)),
        null,
        2,
      );
    case "names":
      return many(() => fake.fullName(rng)).join("\n");
    case "emails":
      return many(() => fake.email(rng)).join("\n");
    case "uuids":
      return many(() => fake.uuid(rng)).join("\n");
  }
}
