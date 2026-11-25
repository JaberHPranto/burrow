import { commands } from "@/core/platform/commands";
import { storage } from "@/core/storage/storage";
import { create } from "zustand";
import { DEFAULT_SETTINGS, type Settings, mergeSettings } from "./settings";

const scope = storage.scope("settings");

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  /** Shallow-merge a patch (pass whole nested objects, e.g. `{ clipboard: {...s.clipboard, enabled} }`). */
  update: (patch: Partial<Settings>) => void;
}

/** Push settings that live on the native side. */
function applyNative(s: Settings) {
  void commands.setHideOnBlur(s.hideOnBlur).catch(() => {});
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    // Older versions kept the theme in the "app" scope — carry it over once.
    const [stored, legacyTheme] = await Promise.all([
      scope.get<unknown>("all"),
      storage.scope("app").get<string>("theme"),
    ]);
    const base = stored ?? (legacyTheme ? { theme: legacyTheme } : undefined);
    const settings = mergeSettings(base);
    set({ settings, loaded: true });
    applyNative(settings);
  },

  update(patch) {
    const settings = mergeSettings({ ...get().settings, ...patch });
    set({ settings });
    void scope.set("all", settings);
    applyNative(settings);
  },
}));
