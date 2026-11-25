import { type Emoji, type RawEmoji, type ShortcodeMap, buildEmojis } from "./logic";

let loading: Promise<Emoji[]> | null = null;

/**
 * Load the emoji list (emojibase data + GitHub shortcodes like :tada:).
 * The JSON is a separate lazy chunk, so it only loads when the picker opens,
 * and it's parsed once per session.
 */
export function loadEmojis(): Promise<Emoji[]> {
  loading ??= Promise.all([
    import("emojibase-data/en/data.json"),
    import("emojibase-data/en/shortcodes/github.json"),
  ]).then(([data, codes]) =>
    buildEmojis(data.default as unknown as RawEmoji[], codes.default as unknown as ShortcodeMap),
  );
  return loading;
}
