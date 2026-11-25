import { autostart } from "@/core/platform/autostart";
import { type ClipboardBridgeStatus, type WindowMode, commands } from "@/core/platform/commands";
import { isTauri } from "@/core/platform/runtime";
import { useSettings } from "@/core/settings/store";
import { Button, Kbd, Segmented, Switch, toast } from "@/design";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Section, SettingRow } from "../Section";
import styles from "../settings.module.css";

const MODES = [
  { value: "launcher", label: "Launcher" },
  { value: "pinned", label: "Pinned" },
  { value: "normal", label: "Normal" },
] as const;

const MODE_HELP: Record<WindowMode, string> = {
  launcher: "Hides when you click elsewhere, like Spotlight. Open it again with your hotkey.",
  pinned:
    "Stays open and above other windows until you unpin it. Also: the pin button in the header.",
  normal: "Stays open like a regular window: other windows can cover it, and it shows in Alt+Tab.",
};

/**
 * GNOME on Wayland ignores an app's own "always on top"; the Burrow GNOME
 * extension (the same one used for clipboard history) does it instead.
 */
function OnTopHelp() {
  const [bridge, setBridge] = useState<ClipboardBridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void commands
      .clipboardBridgeStatus()
      .then(setBridge)
      .catch(() => {});
  }, []);

  async function install() {
    setBusy(true);
    try {
      toast.success(await commands.installClipboardExtension());
      setBridge(await commands.clipboardBridgeStatus());
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  const waitingForLogin = bridge?.installed && !bridge.outdated;
  return (
    <div className={styles.callout}>
      <p className={styles.rowHelp}>
        Burrow stays open, but GNOME on Wayland doesn't let apps keep themselves on top. The Burrow
        GNOME extension can do it for you. Until then, press <Kbd>Alt</Kbd>+<Kbd>Space</Kbd> on
        Burrow and choose “Always on Top”.
      </p>
      {waitingForLogin ? (
        <p className={styles.rowHelp}>
          Extension installed: log out and back in once to activate it.
        </p>
      ) : (
        <div>
          <Button
            size="sm"
            variant="primary"
            icon={Download}
            disabled={busy}
            onClick={() => void install()}
          >
            {bridge?.outdated ? "Update the extension" : "Install the extension"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function General() {
  const settings = useSettings((s) => s.settings);
  const keepAbove = useSettings((s) => s.keepAbove);
  const update = useSettings((s) => s.update);
  const [startOnLogin, setStartOnLogin] = useState<boolean | null>(null);

  useEffect(() => {
    void autostart
      .isEnabled()
      .then(setStartOnLogin)
      .catch(() => setStartOnLogin(false));
  }, []);

  async function toggleAutostart(on: boolean) {
    try {
      await autostart.set(on);
      setStartOnLogin(on);
    } catch (err) {
      toast.error(`Couldn't change start on login: ${String(err)}`);
    }
  }

  return (
    <Section title="General">
      <SettingRow
        label="Start on login"
        help={
          isTauri()
            ? "Burrow starts quietly in the tray when you log in."
            : "Available in the desktop app."
        }
      >
        <Switch
          label="Start on login"
          checked={startOnLogin ?? false}
          onChange={(on) => void toggleAutostart(on)}
        />
      </SettingRow>
      <SettingRow label="Window" help={MODE_HELP[settings.windowMode]}>
        <Segmented
          label="Window behaviour"
          value={settings.windowMode}
          options={MODES}
          onChange={(windowMode: WindowMode) => update({ windowMode })}
        />
      </SettingRow>
      {settings.windowMode === "pinned" && keepAbove === false && <OnTopHelp />}
      <SettingRow
        label="Clipboard suggestions"
        help="When the launcher opens, suggest a tool for what you've copied (JSON, a colour, a schema…)."
      >
        <Switch
          label="Clipboard suggestions"
          checked={settings.clipboardSuggestions}
          onChange={(clipboardSuggestions) => update({ clipboardSuggestions })}
        />
      </SettingRow>
    </Section>
  );
}
