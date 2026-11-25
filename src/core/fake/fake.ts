/**
 * Shared fake-data primitives (seeded, deterministic for tests).
 * Used by the "Lorem & fake data" and "Schema → mock" tools.
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

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export const pick = <T>(rng: Rng, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)] as T;

/** Inclusive integer in [min, max]. */
export const int = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

export const float = (rng: Rng, min: number, max: number, decimals = 2) =>
  Number((min + rng() * (max - min)).toFixed(decimals));

export const bool = (rng: Rng) => rng() < 0.5;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut " +
  "labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris " +
  "nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse " +
  "cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui " +
  "officia deserunt mollit anim id est laborum"
).split(" ");

export const FIRST_NAMES = [
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
export const LAST_NAMES = [
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
export const STREETS = [
  "Lake View Rd",
  "Banyan St",
  "Gulshan Ave",
  "Maple Lane",
  "River Rd",
  "Station Rd",
  "Park Circle",
  "Hill Top Way",
];
export const CITIES = [
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
export const COUNTRIES = [
  "Bangladesh",
  "Singapore",
  "Germany",
  "Canada",
  "Japan",
  "Portugal",
  "Malaysia",
];
export const DOMAINS = ["example.com", "mail.test", "burrow.dev", "acme.io"];
export const COMPANIES = [
  "Carrot Labs",
  "Hopscotch Inc",
  "Warren & Co",
  "Meadow Systems",
  "Clover Tech",
];
export const PRODUCTS = [
  "Carrot Cake",
  "Burrow Hoodie",
  "Clover Tea",
  "Meadow Mug",
  "Hopper Shoes",
  "Warren Lamp",
];

export const fake = {
  words: (rng: Rng, count: number) =>
    Array.from({ length: count }, () => pick(rng, WORDS)).join(" "),
  sentence: (rng: Rng) => `${capitalize(fake.words(rng, int(rng, 6, 14)))}.`,
  paragraph: (rng: Rng) =>
    Array.from({ length: int(rng, 3, 6) }, () => fake.sentence(rng)).join(" "),
  firstName: (rng: Rng) => pick(rng, FIRST_NAMES),
  lastName: (rng: Rng) => pick(rng, LAST_NAMES),
  fullName: (rng: Rng) => `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
  username: (rng: Rng) => `${pick(rng, FIRST_NAMES)}_${int(rng, 10, 999)}`.toLowerCase(),
  email: (rng: Rng, name?: string) => {
    const handle = (name ?? `${pick(rng, FIRST_NAMES)}.${pick(rng, LAST_NAMES)}`)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\s+/g, ".")
      .replace(/[^a-z.]/g, "");
    return `${handle}${int(rng, 1, 99)}@${pick(rng, DOMAINS)}`;
  },
  phone: (rng: Rng) => `+880 1${int(rng, 3, 9)}${int(rng, 10, 99)}-${int(rng, 100000, 999999)}`,
  company: (rng: Rng) => pick(rng, COMPANIES),
  product: (rng: Rng) => pick(rng, PRODUCTS),
  street: (rng: Rng) => `${int(rng, 1, 250)} ${pick(rng, STREETS)}`,
  city: (rng: Rng) => pick(rng, CITIES),
  country: (rng: Rng) => pick(rng, COUNTRIES),
  zip: (rng: Rng) => String(int(rng, 1000, 9999)),
  address: (rng: Rng) => `${fake.street(rng)}, ${fake.city(rng)}`,
  uuid: (rng: Rng) => {
    const hex = Array.from({ length: 32 }, () => int(rng, 0, 15).toString(16));
    hex[12] = "4";
    hex[16] = ((int(rng, 0, 15) & 0x3) | 0x8).toString(16);
    const h = hex.join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  },
  /** ISO timestamp between 2024-01-01 and ~2025-12. */
  dateTime: (rng: Rng) =>
    new Date(
      Date.UTC(2024, 0, 1) + int(rng, 0, 700) * 86_400_000 + int(rng, 0, 86_399) * 1000,
    ).toISOString(),
  date: (rng: Rng) => fake.dateTime(rng).slice(0, 10),
  url: (rng: Rng) => `https://${pick(rng, DOMAINS)}/${pick(rng, WORDS)}/${int(rng, 1, 999)}`,
  ipv4: (rng: Rng) => Array.from({ length: 4 }, () => int(rng, 1, 254)).join("."),
  hexColor: (rng: Rng) => `#${int(rng, 0, 0xffffff).toString(16).padStart(6, "0")}`,
  password: (rng: Rng) =>
    `${capitalize(pick(rng, WORDS))}-${pick(rng, WORDS)}-${int(rng, 10, 99)}!`,
};
