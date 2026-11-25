/**
 * Convert keyboard events to GNOME accelerator strings (`<Control><Alt>s`) and
 * back to readable labels. Mirrors the validation in `commands/hotkeys.rs`.
 * Uses `event.code` for letters/digits so shortcuts don't depend on keyboard layout.
 */

export interface KeyLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const CODE_TO_KEY: Record<string, string> = {
  Space: "space",
  Enter: "Return",
  Tab: "Tab",
  PrintScreen: "Print",
  Comma: "comma",
  Period: "period",
  Slash: "slash",
  Minus: "minus",
  Equal: "equal",
  Backquote: "grave",
  Semicolon: "semicolon",
  Quote: "apostrophe",
  BracketLeft: "bracketleft",
  BracketRight: "bracketright",
  Backslash: "backslash",
  Home: "Home",
  End: "End",
  PageUp: "Page_Up",
  PageDown: "Page_Down",
  Insert: "Insert",
  Delete: "Delete",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

const MODIFIER_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Meta",
  "Super",
  "OS",
  "AltGraph",
  "Hyper",
]);

function keyToken(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return CODE_TO_KEY[code] ?? null;
}

export type AcceleratorResult =
  | { ok: true; accelerator: string }
  | { ok: false; reason: "modifier-only" | "unsupported-key" | "needs-modifier" };

export function toAccelerator(e: KeyLike): AcceleratorResult {
  if (MODIFIER_KEYS.has(e.key)) return { ok: false, reason: "modifier-only" };
  const key = keyToken(e.code);
  if (!key) return { ok: false, reason: "unsupported-key" };
  const mods = [
    e.ctrlKey && "<Control>",
    e.altKey && "<Alt>",
    e.shiftKey && "<Shift>",
    e.metaKey && "<Super>",
  ].filter(Boolean);
  const standalone = /^F\d+$/.test(key) || key === "Print";
  if (mods.length === 0 && !standalone) return { ok: false, reason: "needs-modifier" };
  return { ok: true, accelerator: `${mods.join("")}${key}` };
}

const LABELS: Record<string, string> = {
  Control: "Ctrl",
  Primary: "Ctrl",
  Super: "Super",
  space: "Space",
  Return: "Enter",
  Page_Up: "PgUp",
  Page_Down: "PgDn",
  comma: ",",
  period: ".",
  slash: "/",
  minus: "-",
  equal: "=",
  grave: "`",
  semicolon: ";",
  apostrophe: "'",
  bracketleft: "[",
  bracketright: "]",
  backslash: "\\",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
};

/** `<Control><Alt>space` → ["Ctrl", "Alt", "Space"] */
export function acceleratorParts(accel: string): string[] {
  const mods = [...accel.matchAll(/<([^>]+)>/g)].map(
    (m) => LABELS[m[1] as string] ?? (m[1] as string),
  );
  const key = accel.replace(/<[^>]+>/g, "");
  const label = LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return [...mods, label];
}

/** Shortcuts GNOME/Ubuntu already use — warn before overriding them. */
const RESERVED: Record<string, string> = {
  "<Control><Alt>t": "opens Terminal",
  "<Super>space": "switches input language",
  "<Control><Alt>Delete": "logs out",
  "<Super>l": "locks the screen",
  "<Super>a": "shows apps",
  "<Super>v": "opens notifications",
  "<Alt>F2": "runs a command",
  "<Alt>F4": "closes windows",
  "<Alt>Tab": "switches apps",
  "<Control><Alt>Left": "switches workspace",
  "<Control><Alt>Right": "switches workspace",
  Print: "takes a screenshot",
  "<Shift>Print": "takes a screenshot",
  "<Alt>Print": "takes a screenshot",
};

export function reservedReason(accel: string): string | null {
  return RESERVED[accel] ?? null;
}
