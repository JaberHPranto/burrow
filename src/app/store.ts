import { storage } from "@/core/storage/storage";
import { create } from "zustand";

export interface OpenToolOptions {
  input?: string;
  autoRun?: boolean;
}

export type Route =
  | { name: "home" }
  /** `nonce` changes on every open, so re-running a tool (e.g. a 2nd capture) remounts it. */
  | { name: "tool"; id: string; input?: string; autoRun?: boolean; nonce: number };

const MAX_RECENTS = 6;
const prefs = storage.scope("app");

interface AppState {
  route: Route;
  recents: string[];
  theme: "dark" | "light";
  openTool: (id: string, options?: OpenToolOptions) => void;
  goHome: () => void;
  toggleTheme: () => void;
  hydrate: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  route: { name: "home" },
  recents: [],
  theme: "dark",

  openTool(id, options = {}) {
    const recents = [id, ...get().recents.filter((r) => r !== id)].slice(0, MAX_RECENTS);
    const current = get().route;
    // Re-opening the tool that's already showing keeps it mounted unless it should re-run.
    const nonce =
      current.name === "tool" && current.id === id && !options.autoRun ? current.nonce : Date.now();
    set({ route: { name: "tool", id, ...options, nonce }, recents });
    void prefs.set("recents", recents);
  },

  goHome() {
    set({ route: { name: "home" } });
  },

  toggleTheme() {
    const theme = get().theme === "dark" ? "light" : "dark";
    set({ theme });
    void prefs.set("theme", theme);
  },

  async hydrate() {
    const [recents, theme] = await Promise.all([
      prefs.get<string[]>("recents"),
      prefs.get<AppState["theme"]>("theme"),
    ]);
    set({ recents: recents ?? [], theme: theme ?? "dark" });
  },
}));
