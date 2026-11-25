/**
 * Flameshot-style region capture without GNOME's dialog:
 *   1. grab the whole desktop silently (window hidden)
 *   2. cut it into one image per monitor and show the current monitor's part
 *      fullscreen at native resolution (Tab cycles monitors)
 *   3. the user drags a region; resolve with the cropped PNG and the chosen action
 *
 * Usage:
 *   const snip = useSnip();
 *   const result = await snip.start({ withActions: true }); // null if cancelled
 *   …
 *   return <>{ui}{snip.overlay}</>;
 */
import { commands } from "@/core/platform/commands";
import { getMonitorLayout, overlayWindow } from "@/core/platform/window";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { type SnipAction, SnipOverlay } from "./SnipOverlay";
import { type Box, monitorRegions } from "./geometry";
import { cropToPng, decodeImage } from "./image";

export type { SnipAction } from "./SnipOverlay";

export interface SnipResult {
  /** Cropped region as PNG, at full screen resolution. */
  bytes: Uint8Array;
  /** Chosen action, or null when started without actions. */
  action: SnipAction | null;
}

interface Session {
  /** One full-resolution image per monitor. */
  screens: ImageBitmap[];
  index: number;
  withActions: boolean;
  resolve: (result: SnipResult | null) => void;
}

export function useSnip(): {
  start: (opts?: { withActions?: boolean }) => Promise<SnipResult | null>;
  overlay: ReactNode;
  active: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const busy = useRef(false);

  const start = useCallback(async ({ withActions = true } = {}) => {
    if (busy.current) return null;
    busy.current = true;
    try {
      const [desktop, layout] = await Promise.all([
        commands.captureScreenshot({ interactive: false, reshow: false }).then(decodeImage),
        getMonitorLayout().catch(() => null),
      ]);
      const regions = monitorRegions(
        layout?.monitors ?? [],
        desktop.naturalWidth,
        desktop.naturalHeight,
      );
      const screens = await Promise.all(
        regions.map((r) => createImageBitmap(desktop, r.x, r.y, r.w, r.h)),
      );
      const index = regions.length > 1 ? Math.min(layout?.current ?? 0, screens.length - 1) : 0;
      await overlayWindow.enter();
      return await new Promise<SnipResult | null>((resolve) =>
        setSession({ screens, index, withActions, resolve }),
      );
    } finally {
      busy.current = false;
    }
  }, []);

  const finish = useCallback(
    async (result: { box: Box; action: SnipAction | null } | null) => {
      if (!session) return;
      setSession(null);
      await overlayWindow.exit();
      const screen = session.screens[session.index];
      try {
        session.resolve(
          result && screen
            ? { bytes: await cropToPng(screen, result.box), action: result.action }
            : null,
        );
      } finally {
        for (const s of session.screens) s.close();
      }
    },
    [session],
  );

  const screen = session?.screens[session.index];
  const overlay =
    session && screen ? (
      <SnipOverlay
        key={session.index}
        image={screen}
        withActions={session.withActions}
        monitor={
          session.screens.length > 1
            ? { index: session.index, count: session.screens.length }
            : null
        }
        onNextMonitor={() =>
          setSession((s) => (s ? { ...s, index: (s.index + 1) % s.screens.length } : s))
        }
        onDone={(box, action) => void finish({ box, action })}
        onCancel={() => void finish(null)}
      />
    ) : null;

  return { start, overlay, active: session !== null };
}
