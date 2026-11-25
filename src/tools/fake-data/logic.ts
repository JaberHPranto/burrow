/**
 * Lorem ipsum and fake records. Uses a seedable PRNG so output is
 * reproducible in tests; the UI passes a fresh random seed.
 */

export type Rng = () => number;

/** mulberry32 — tiny, fast, good enough for fake data (not for secrets). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)] as T;
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const LOREM = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut " +
  "labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris " +
  "nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse " +
  "cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui " +
  "officia deserunt mollit anim id est laborum"
).split(" ");

const FIRST = [
  "Ayesha",
  "Rafi",
  "Nadia",
  "Tanvir",
  "Mira",
  "Arif",
  "Sara",
  "Imran",
  "Lina",
  "Omar",
  "Priya",
  "Daniel",
  "Emma",
  "Kenji",
  "Zara",
  "Leo",
];
const LAST = [
  "Rahman",
  "Hossain",
  "Ahmed",
  "Chowdhury",
  "Islam",
  "Karim",
  "Khan",
  "Smith",
  "Garcia",
  "Tanaka",
  "Silva",
  "Müller",
  "Okafor",
  "Nguyen",
];
const STREETS = [
  "Lake View Rd",
  "Banyan St",
  "Gulshan Ave",
  "Maple Lane",
  "River Rd",
  "Station Rd",
  "Park Circle",
  "Hill Top Way",
];
const CITIES = [
  "Dhaka",
  "Chattogram",
  "Sylhet",
  "Khulna",
  "Singapore",
  "Berlin",
  "Toronto",
  "Tokyo",
  "Lisbon",
];
const DOMAINS = ["example.com", "mail.test", "burrow.dev", "acme.io"];
const COMPANIES = ["Carrot Labs", "Hopscotch Inc", "Warren & Co", "Meadow Systems", "Clover Tech"];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function loremWords(rng: Rng, count: number): string {
  return Array.from({ length: count }, () => pick(rng, LOREM)).join(" ");
}

export function loremSentence(rng: Rng): string {
  return `${capitalize(loremWords(rng, int(rng, 6, 14)))}.`;
}

export function loremParagraph(rng: Rng): string {
  return Array.from({ length: int(rng, 3, 6) }, () => loremSentence(rng)).join(" ");
}

export interface Person {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  createdAt: string;
}

function uuidFrom(rng: Rng): string {
  const hex = Array.from({ length: 32 }, () => int(rng, 0, 15).toString(16));
  hex[12] = "4";
  hex[16] = ((int(rng, 0, 15) & 0x3) | 0x8).toString(16);
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function person(rng: Rng): Person {
  const first = pick(rng, FIRST);
  const last = pick(rng, LAST);
  const handle = `${first}.${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z.]/g, "");
  const created = new Date(Date.UTC(2024, 0, 1) + int(rng, 0, 700) * 86_400_000);
  return {
    id: uuidFrom(rng),
    name: `${first} ${last}`,
    email: `${handle}${int(rng, 1, 99)}@${pick(rng, DOMAINS)}`,
    phone: `+880 1${int(rng, 3, 9)}${int(rng, 10, 99)}-${int(rng, 100000, 999999)}`,
    company: pick(rng, COMPANIES),
    address: `${int(rng, 1, 250)} ${pick(rng, STREETS)}, ${pick(rng, CITIES)}`,
    createdAt: created.toISOString(),
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

export const FAKE_KINDS: ReadonlyArray<{ value: FakeKind; label: string; json: boolean }> = [
  { value: "paragraphs", label: "Paragraphs", json: false },
  { value: "sentences", label: "Sentences", json: false },
  { value: "words", label: "Words", json: false },
  { value: "people", label: "People (JSON)", json: true },
  { value: "names", label: "Names", json: false },
  { value: "emails", label: "Emails", json: false },
  { value: "uuids", label: "UUIDs", json: false },
];

export function generate(kind: FakeKind, count: number, rng: Rng): string {
  const n = Math.max(1, Math.min(count, 500));
  const many = <T>(fn: () => T) => Array.from({ length: n }, fn);
  switch (kind) {
    case "paragraphs":
      return many(() => loremParagraph(rng)).join("\n\n");
    case "sentences":
      return many(() => loremSentence(rng)).join(" ");
    case "words":
      return loremWords(rng, n);
    case "people":
      return JSON.stringify(
        many(() => person(rng)),
        null,
        2,
      );
    case "names":
      return many(() => person(rng).name).join("\n");
    case "emails":
      return many(() => person(rng).email).join("\n");
    case "uuids":
      return many(() => uuidFrom(rng)).join("\n");
  }
}
