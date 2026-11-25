/**
 * In-memory hand-off of data between tools (e.g. the screenshot editor sends
 * its image to OCR). `take` removes the value, so it's consumed exactly once.
 * Keys are namespaced by the receiving tool: "ocr:image".
 */
const slots = new Map<string, unknown>();

export const handoff = {
  put(key: string, value: unknown): void {
    slots.set(key, value);
  },
  take<T>(key: string): T | undefined {
    const value = slots.get(key) as T | undefined;
    slots.delete(key);
    return value;
  },
};
