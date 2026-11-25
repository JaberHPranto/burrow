import { commands } from "@/core/platform/commands";
import { create } from "zustand";
import type { DependencyStatus } from "./logic";

interface DepsState {
  /** null until the first check finishes. */
  status: DependencyStatus | null;
  checking: boolean;
  refresh: () => Promise<void>;
}

/** Installed-package status, checked at startup and when the user asks to re-check. */
export const useDeps = create<DepsState>((set, get) => ({
  status: null,
  checking: false,
  async refresh() {
    if (get().checking) return;
    set({ checking: true });
    try {
      const list = await commands.checkDependencies();
      set({ status: Object.fromEntries(list.map((d) => [d.id, d.installed])) });
    } catch {
      // Unknown status shows no badges — better than a false alarm.
    } finally {
      set({ checking: false });
    }
  },
}));
