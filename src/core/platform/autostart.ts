import { isTauri } from "./runtime";

/** Start-on-login via tauri-plugin-autostart (writes ~/.config/autostart/Burrow.desktop). */
export const autostart = {
  async isEnabled(): Promise<boolean> {
    if (!isTauri()) return false;
    const { isEnabled } = await import("@tauri-apps/plugin-autostart");
    return isEnabled();
  },
  async set(enabled: boolean): Promise<void> {
    if (!isTauri()) return;
    const mod = await import("@tauri-apps/plugin-autostart");
    await (enabled ? mod.enable() : mod.disable());
  },
};
