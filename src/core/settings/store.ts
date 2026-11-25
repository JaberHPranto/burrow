import { type WindowMode, commands } from "@/core/platform/commands";
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
  /** Pin button: pinned ↔ the mode used before pinning. */
  togglePin: () => void;
  /** Whether Pinned actually keeps the window on top (null until known). */
  keepAbove: boolean | null;
}

/** The mode to return to when unpinning (not persisted; defaults to the launcher). */
let unpinnedMode: Exclude<WindowMode, "pinned"> = "launcher";
let appliedMode: WindowMode | null = null;

export const useSettings = create<SettingsState>((set, get) => {
  /** Push settings that live on the native side. */
  function applyNative(s: Settings) {
    if (s.windowMode === appliedMode) return;
    appliedMode = s.windowMode;
    if (s.windowMode !== "pinned") unpinnedMode = s.windowMode;
    commands
      .setWindowMode(s.windowMode)
      .then(({ keepAbove }) => set({ keepAbove }))
      .catch(() => {});
  }

  return {
    settings: DEFAULT_SETTINGS,
    loaded: false,
    keepAbove: null,

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

    togglePin() {
      const { windowMode } = get().settings;
      get().update({ windowMode: windowMode === "pinned" ? unpinnedMode : "pinned" });
    },
  };
});
