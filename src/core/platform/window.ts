import { useEffect } from "react";
import { isTauri } from "./runtime";

/** Launcher size — keep in sync with `tauri.conf.json`. */
export const DEFAULT_WINDOW = { width: 760, height: 520 } as const;

async function resize(width: number, height: number) {
  if (!isTauri()) return;
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(width, height));
  await win.center();
}

/**
 * Grow the window while a tool needs room (e.g. the screenshot editor) and
 * restore the launcher size when it unmounts. Pass `active=false` to skip.
 */
export function useWindowSize(width: number, height: number, active = true) {
  useEffect(() => {
    if (!active) return;
    void resize(width, height);
    return () => void resize(DEFAULT_WINDOW.width, DEFAULT_WINDOW.height);
  }, [width, height, active]);
}

/**
 * Fullscreen overlay mode for region selection (the window is hidden while the
 * screen is captured, then shown fullscreen on top of everything).
 */
export const overlayWindow = {
  async enter(): Promise<void> {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setFullscreen(true);
    await win.show();
    await win.setFocus();
  },
  async exit(): Promise<void> {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(false);
  },
};
