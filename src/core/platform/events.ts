import { isTauri } from "./runtime";

/** Event names emitted by Rust — mirror of `src-tauri/src/window.rs`. */
export type { OpenToolRequest } from "./commands";

export const EVENTS = {
  openTool: "burrow://open-tool",
  shown: "burrow://shown",
} as const;

type Unlisten = () => void;

/** Subscribe to a backend event. Returns an unsubscribe function (no-op in the browser). */
export async function onEvent<T>(name: string, handler: (payload: T) => void): Promise<Unlisten> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(name, (e) => handler(e.payload));
}
