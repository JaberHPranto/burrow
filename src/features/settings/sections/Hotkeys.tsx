import { type HotkeysState, commands } from "@/core/platform/commands";
import { acceleratorParts, reservedReason, toAccelerator } from "@/core/settings/accelerator";
import { cx } from "@/core/utils/cx";
import { Button, ErrorNote, IconButton, Kbd, toast } from "@/design";
import { Keyboard, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Section } from "../Section";
import styles from "../settings.module.css";

const REASONS = {
  "modifier-only": null,
  "unsupported-key": "That key can't be used for a shortcut.",
  "needs-modifier": "Add Ctrl, Alt, Shift or Super (only F1–F12 and Print work alone).",
} as const;

/** "Burrow: grab text (OCR)" (the name GNOME shows) → "Grab text (OCR)". */
function label(name: string): string {
  const short = name.replace(/^Burrow:\s*/, "");
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export function Hotkeys() {
  const [state, setState] = useState<HotkeysState | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => setState(await commands.getHotkeys()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (id: string, binding: string | null) => {
      try {
        await commands.setHotkey(id, binding);
        await refresh();
        toast.success(binding ? "Shortcut saved" : "Shortcut removed");
      } catch (err) {
        toast.error(String(err));
      }
    },
    [refresh],
  );

  // While recording, the next valid key combo becomes the shortcut.
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(null);
        setHint(null);
        return;
      }
      if (e.key === "Backspace" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        void save(recording, null);
        setRecording(null);
        return;
      }
      const result = toAccelerator(e);
      if (!result.ok) {
        setHint(REASONS[result.reason]);
        return;
      }
      const taken = state?.hotkeys.find(
        (h) => h.binding === result.accelerator && h.id !== recording,
      );
      if (taken) {
        setHint(`Already used by “${label(taken.name)}”.`);
        return;
      }
      const reserved = reservedReason(result.accelerator);
      if (reserved) {
        setHint(`GNOME already uses this (it ${reserved}). Try another.`);
        return;
      }
      setRecording(null);
      setHint(null);
      void save(recording, result.accelerator);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, state, save]);

  return (
    <Section
      title="Hotkeys"
      description="Global shortcuts that work anywhere. Burrow saves them as GNOME custom shortcuts (Settings → Keyboard), so they keep working after a restart."
    >
      {state && !state.supported && (
        <ErrorNote>Global hotkeys need GNOME (gsettings wasn't found).</ErrorNote>
      )}
      {state?.hotkeys.map((h) => {
        const isRecording = recording === h.id;
        return (
          <div key={h.id} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>{label(h.name)}</span>
              {isRecording && (
                <span className={styles.rowHelp}>
                  {hint ?? "Press the new shortcut… (Esc to cancel, Backspace to remove)"}
                </span>
              )}
            </div>
            <div className={styles.rowControl}>
              <button
                type="button"
                className={cx(styles.keyButton, isRecording && styles.keyRecording)}
                onClick={() => {
                  setHint(null);
                  setRecording(isRecording ? null : h.id);
                }}
                disabled={!state.supported}
                aria-label={`Change shortcut for ${label(h.name)}`}
              >
                {isRecording ? (
                  <span className={styles.recordingDot}>Recording…</span>
                ) : h.binding ? (
                  acceleratorParts(h.binding).map((p) => <Kbd key={p}>{p}</Kbd>)
                ) : (
                  <span className={styles.unset}>
                    <Keyboard aria-hidden /> Set shortcut
                  </span>
                )}
              </button>
              {h.binding && !isRecording && (
                <IconButton
                  icon={X}
                  label="Remove shortcut"
                  onClick={() => void save(h.id, null)}
                />
              )}
            </div>
          </div>
        );
      })}
      {state?.supported && (
        <div className={styles.footnote}>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            Reload from GNOME
          </Button>
        </div>
      )}
    </Section>
  );
}
