/**
 * Flameshot-style region capture without GNOME's dialog:
 *   1. grab the whole screen silently (portal, non-interactive, window hidden)
 *   2. show it in a fullscreen overlay; the user drags a region
 *   3. resolve with the cropped PNG and the chosen action
 *
 * Usage:
 *   const snip = useSnip();
 *   const result = await snip.start({ withActions: true }); // null if cancelled
 *   …
 *   return <>{ui}{snip.overlay}</>;
 */
import { commands } from "@/core/platform/commands";
import { overlayWindow } from "@/core/platform/window";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { type SnipAction, SnipOverlay } from "./SnipOverlay";
import type { Box } from "./geometry";
import { cropToPng } from "./image";

export type { SnipAction } from "./SnipOverlay";

export interface SnipResult {
  /** Cropped region as PNG. */
  bytes: Uint8Array;
  /** Chosen action, or null when started without actions. */
  action: SnipAction | null;
}

interface Session {
  image: HTMLImageElement;
  /** Object URL backing `image`; revoked when the session ends. */
  url: string;
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
      const screen = await commands.captureScreenshot({ interactive: false, reshow: false });
      const url = URL.createObjectURL(new Blob([new Uint8Array(screen)], { type: "image/png" }));
      const image = new Image();
      image.src = url;
      await image.decode();
      await overlayWindow.enter();
      return await new Promise<SnipResult | null>((resolve) =>
        setSession({ image, url, withActions, resolve }),
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
      try {
        session.resolve(
          result
            ? { bytes: await cropToPng(session.image, result.box), action: result.action }
            : null,
        );
      } finally {
        URL.revokeObjectURL(session.url);
      }
    },
    [session],
  );

  const overlay = session ? (
    <SnipOverlay
      image={session.image}
      withActions={session.withActions}
      onDone={(box, action) => void finish({ box, action })}
      onCancel={() => void finish(null)}
    />
  ) : null;

  return { start, overlay, active: session !== null };
}
