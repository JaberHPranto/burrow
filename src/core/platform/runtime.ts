/**
 * True inside the Tauri webview. False in a plain browser (`npm run dev`),
 * where the platform layer falls back to web APIs and mock data so the UI
 * can be developed and previewed without the native shell.
 */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
