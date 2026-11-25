import { isTauri } from "./runtime";

/** Clipboard access that works in the Tauri app and in a dev browser. */
export const clipboard = {
  async readText(): Promise<string> {
    try {
      if (isTauri()) {
        const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
        return (await readText()) ?? "";
      }
      return await navigator.clipboard.readText();
    } catch {
      return ""; // empty clipboard, non-text content, or permission denied
    }
  },

  async writeText(text: string): Promise<void> {
    if (isTauri()) {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  },
};
