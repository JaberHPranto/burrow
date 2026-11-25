import { describe, expect, it } from "vitest";
import {
  type RawEmoji,
  buildEmojis,
  codepoints,
  htmlEntity,
  layoutGrid,
  moveInGrid,
  pushRecent,
  resolveRecents,
  searchEmojis,
  supportedOnly,
  withSkin,
} from "./logic";

const tones = ["🏻", "🏼", "🏽", "🏾", "🏿"];
const RAW: RawEmoji[] = [
  {
    label: "grinning face",
    hexcode: "1F600",
    emoji: "😀",
    group: 0,
    order: 1,
    version: 1,
    tags: ["face", "grin"],
  },
  {
    label: "party popper",
    hexcode: "1F389",
    emoji: "🎉",
    group: 6,
    order: 50,
    version: 0.6,
    tags: ["celebration", "party", "tada"],
  },
  {
    label: "waving hand",
    hexcode: "1F44B",
    emoji: "👋",
    group: 1,
    order: 10,
    version: 0.6,
    tags: ["hello", "wave"],
    skins: tones.map((t, i) => ({ emoji: `👋${t}`, tone: 5 - i })),
  },
  {
    label: "red heart",
    hexcode: "2764",
    emoji: "❤️",
    group: 0,
    order: 5,
    version: 0.6,
    tags: ["heart", "love"],
  },
  { label: "light skin tone", hexcode: "1F3FB", emoji: "🏻", group: 2, order: 2, version: 1 },
  { label: "regional indicator A", hexcode: "1F1E6", emoji: "🇦", version: 2 },
  {
    label: "face with bags under eyes",
    hexcode: "1FAE9",
    emoji: "🫩",
    group: 0,
    order: 3,
    version: 16,
    tags: ["tired"],
  },
];
const list = buildEmojis(RAW, { "1F389": "tada", "1F44B": ["wave", "waving_hand"] });

describe("buildEmojis", () => {
  it("drops components and ungrouped entries and sorts by order", () => {
    expect(list.map((e) => e.emoji)).toEqual(["😀", "🫩", "❤️", "👋", "🎉"]);
  });

  it("attaches shortcodes and orders skin tones light → dark", () => {
    const wave = list.find((e) => e.hexcode === "1F44B");
    expect(wave?.shortcodes).toEqual(["wave", "waving_hand"]);
    if (!wave) throw new Error("missing");
    // Tones arrive dark → light in RAW; tone 1 (light) must come first.
    expect(withSkin(wave, 1)).toBe("👋🏿");
    expect(withSkin(wave, 5)).toBe("👋🏻");
    expect(withSkin(wave, 0)).toBe("👋");
  });

  it("falls back to the plain emoji when there are no skins", () => {
    const grin = list.find((e) => e.hexcode === "1F600");
    expect(grin && withSkin(grin, 3)).toBe("😀");
  });
});

describe("supportedOnly", () => {
  it("hides emoji newer than the font supports", () => {
    expect(supportedOnly(list, 15).map((e) => e.hexcode)).not.toContain("1FAE9");
  });
});

describe("searchEmojis", () => {
  it("matches names, shortcodes (with or without colons) and tags", () => {
    expect(searchEmojis(list, "party")[0]?.emoji).toBe("🎉");
    expect(searchEmojis(list, ":tada:")[0]?.emoji).toBe("🎉");
    expect(searchEmojis(list, "hello")[0]?.emoji).toBe("👋");
    expect(searchEmojis(list, "hand")[0]?.emoji).toBe("👋");
  });

  it("ranks name prefixes above later words in the name", () => {
    // "face with bags…" starts with "face"; "grinning face" only contains it.
    expect(searchEmojis(list, "face").map((e) => e.emoji)).toEqual(["🫩", "😀"]);
  });

  it("requires every word of a multi-word query", () => {
    expect(searchEmojis(list, "heart love").map((e) => e.emoji)).toEqual(["❤️"]);
    expect(searchEmojis(list, "heart party")).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(searchEmojis(list, "  ")).toHaveLength(list.length);
  });
});

describe("copy formats", () => {
  it("formats code points and HTML entities", () => {
    expect(codepoints("👋🏽")).toBe("U+1F44B U+1F3FD");
    expect(codepoints("❤️")).toBe("U+2764 U+FE0F");
    expect(htmlEntity("🎉")).toBe("&#x1F389;");
  });
});

describe("recents", () => {
  it("moves to the front, de-duplicates and caps", () => {
    expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
  });

  it("skips unknown hexcodes", () => {
    const byHex = new Map(list.map((e) => [e.hexcode, e]));
    expect(resolveRecents(["1F389", "GONE"], byHex).map((e) => e.emoji)).toEqual(["🎉"]);
  });
});

describe("grid navigation", () => {
  // Two sections: 5 items and 3 items, 4 columns →
  // row0: 0 1 2 3 | row1: 4 | row2: 5 6 7
  const layout = layoutGrid([5, 3], 4);

  it("starts each section on a new row", () => {
    expect(layout.rowStart).toEqual([0, 4, 5]);
    expect(layout.rowLen).toEqual([4, 1, 3]);
  });

  it("moves up and down keeping the column where possible", () => {
    expect(moveInGrid(2, "ArrowDown", layout)).toBe(4); // short row → last item
    expect(moveInGrid(4, "ArrowDown", layout)).toBe(5);
    expect(moveInGrid(7, "ArrowUp", layout)).toBe(4);
    expect(moveInGrid(1, "ArrowUp", layout)).toBe(1); // top row stays
    expect(moveInGrid(6, "ArrowDown", layout)).toBe(6); // bottom row stays
  });

  it("moves left and right through the flat order, clamped", () => {
    expect(moveInGrid(3, "ArrowRight", layout)).toBe(4);
    expect(moveInGrid(0, "ArrowLeft", layout)).toBe(0);
    expect(moveInGrid(7, "ArrowRight", layout)).toBe(7);
    expect(moveInGrid(3, "End", layout)).toBe(7);
  });

  it("copes with an empty grid", () => {
    expect(moveInGrid(0, "ArrowDown", layoutGrid([], 8))).toBe(0);
  });
});
