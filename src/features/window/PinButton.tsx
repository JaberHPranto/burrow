import { useSettings } from "@/core/settings/store";
import { IconButton, toast } from "@/design";
import { Pin } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./PinButton.module.css";

/**
 * Pin the window: it stays open (and on top, where the system allows) until
 * unpinned. Same setting as Settings → General → Window.
 */
export function PinButton() {
  const pinned = useSettings((s) => s.settings.windowMode === "pinned");
  const keepAbove = useSettings((s) => s.keepAbove);
  const togglePin = useSettings((s) => s.togglePin);
  const justPinned = useRef(false);

  // Once the native side answers, explain if "on top" isn't possible here.
  useEffect(() => {
    if (!justPinned.current || keepAbove === null) return;
    justPinned.current = false;
    if (pinned && !keepAbove) {
      toast.success("Pinned: Burrow stays open. To keep it on top too, see Settings → General.");
    }
  }, [pinned, keepAbove]);

  return (
    <IconButton
      icon={Pin}
      label={pinned ? "Unpin window" : "Pin window (stay open and on top)"}
      className={pinned ? styles.pinned : undefined}
      aria-pressed={pinned}
      onClick={() => {
        justPinned.current = !pinned;
        togglePin();
      }}
    />
  );
}
