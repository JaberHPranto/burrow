import { useEffect } from "react";
import { isTauri } from "./runtime";

/** Launcher content size. */
export const DEFAULT_WINDOW = { width: 760, height: 520 } as const;

/**
 * Transparent margin around the app card that holds its drop shadow
 * (`--window-gutter` in global.css). The OS window is the content size plus
 * this on every side; `tauri.conf.json` uses 760+28 × 520+28.
 */
export const WINDOW_GUTTER = 14;

/**
 * "floating": rounded card with a shadow inside a transparent window (desktop app).
 * "flat": edge to edge (browser dev, fullscreen capture overlay).
 */
export function setWindowChrome(mode: "floating" | "flat"): void {
  document.documentElement.dataset.window = mode;
}

async function resize(width: number, height: number) {
  if (!isTauri()) return;
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(width + WINDOW_GUTTER * 2, height + WINDOW_GUTTER * 2));
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
    setWindowChrome("flat");
    // Show before going fullscreen: GNOME ignores fullscreen requests for unmapped windows.
    await win.show();
    await win.setFullscreen(true);
    await win.setFocus();
  },
  async exit(): Promise<void> {
    if (!isTauri()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(false);
    setWindowChrome("floating");
  },
};

export interface MonitorLayout {
  /** Monitor rectangles in physical desktop pixels. */
  monitors: Array<{ x: number; y: number; w: number; h: number }>;
  /** Index of the monitor Burrow's window is on (where the overlay will go fullscreen). */
  current: number;
}

/** Monitor layout for splitting a whole-desktop screenshot. Null in the browser. */
export async function getMonitorLayout(): Promise<MonitorLayout | null> {
  if (!isTauri()) return null;
  const { availableMonitors, currentMonitor, primaryMonitor } = await import(
    "@tauri-apps/api/window"
  );
  const all = await availableMonitors();
  if (all.length === 0) return null;
  const here = (await currentMonitor()) ?? (await primaryMonitor());
  const current = here
    ? all.findIndex((m) => m.position.x === here.position.x && m.position.y === here.position.y)
    : 0;
  return {
    monitors: all.map((m) => ({
      x: m.position.x,
      y: m.position.y,
      w: m.size.width,
      h: m.size.height,
    })),
    current: Math.max(0, current),
  };
}
