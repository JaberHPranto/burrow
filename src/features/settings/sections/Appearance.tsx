import type { ThemePreference } from "@/core/settings/settings";
import { useSettings } from "@/core/settings/store";
import { Bunny, Segmented, Switch } from "@/design";
import { Section, SettingRow } from "../Section";
import styles from "../settings.module.css";

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const;

export function Appearance() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <Section title="Appearance">
      <SettingRow label="Theme" help="System follows your desktop's light/dark setting.">
        <Segmented
          label="Theme"
          value={settings.theme}
          options={THEMES}
          onChange={(theme: ThemePreference) => update({ theme })}
        />
      </SettingRow>
      <SettingRow label="Show the bunny" help="The mascot next to the launcher search.">
        <Switch
          label="Show the bunny"
          checked={settings.showMascot}
          onChange={(showMascot) => update({ showMascot })}
        />
      </SettingRow>
      <div className={styles.themePreview} aria-hidden>
        {(["dark", "light"] as const).map((t) => (
          <div key={t} data-theme={t} className={styles.themeCard}>
            <Bunny mood="happy" size={44} peek />
            <span>{t === "dark" ? "Dark" : "Light"}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
