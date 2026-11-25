export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop look-alikes such as 0/O and 1/l/I. */
  excludeAmbiguous: boolean;
}

/** Returns a uniformly random integer in [0, max). */
export type RandomInt = (max: number) => number;

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const;

const AMBIGUOUS = new Set("0O1lI|`'\"");

/** Cryptographically secure, unbiased (rejection sampling) random int. */
export const secureRandomInt: RandomInt = (max) => {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max out of range");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const n = buf[0] as number;
    if (n < limit) return n % max;
  }
};

function activeSets(opts: PasswordOptions): string[] {
  return (Object.keys(SETS) as Array<keyof typeof SETS>)
    .filter((k) => opts[k])
    .map((k) => [...SETS[k]].filter((c) => !opts.excludeAmbiguous || !AMBIGUOUS.has(c)).join(""))
    .filter((s) => s.length > 0);
}

/**
 * Generate a password containing at least one character from every enabled set.
 * Returns "" when no set is enabled.
 */
export function generatePassword(opts: PasswordOptions, rand: RandomInt = secureRandomInt): string {
  const sets = activeSets(opts);
  if (sets.length === 0) return "";
  const pool = sets.join("");
  const length = Math.max(opts.length, sets.length);

  const chars = sets.map((set) => set[rand(set.length)] as string);
  while (chars.length < length) chars.push(pool[rand(pool.length)] as string);

  // Fisher–Yates so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join("");
}

export type Strength = "weak" | "fair" | "strong" | "excellent";

/** Entropy estimate for a randomly generated password from these options. */
export function estimateStrength(opts: PasswordOptions): { bits: number; label: Strength } {
  const poolSize = activeSets(opts).join("").length;
  const bits = poolSize > 1 ? Math.round(opts.length * Math.log2(poolSize)) : 0;
  const label: Strength =
    bits < 50 ? "weak" : bits < 75 ? "fair" : bits < 110 ? "strong" : "excellent";
  return { bits, label };
}
