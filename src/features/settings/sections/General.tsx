import { autostart } from "@/core/platform/autostart";
import { isTauri } from "@/core/platform/runtime";
import { useSettings } from "@/core/settings/store";
import { Switch, toast } from "@/design";
import { useEffect, useState } from "react";
import { Section, SettingRow } from "../Section";

export function General() {
  const settings = useSettings((s) => s.settings);
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
      <SettingRow
        label="Hide when unfocused"
        help="Clicking elsewhere closes the launcher, like Spotlight. Turn off to keep it open."
      >
        <Switch
          label="Hide when unfocused"
          checked={settings.hideOnBlur}
          onChange={(hideOnBlur) => update({ hideOnBlur })}
        />
      </SettingRow>
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
