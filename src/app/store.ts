import { storage } from "@/core/storage/storage";
import { create } from "zustand";

export type Route = { name: "home" } | { name: "tool"; id: string; input?: string };

const MAX_RECENTS = 6;
const prefs = storage.scope("app");

interface AppState {
  route: Route;
  recents: string[];
  theme: "dark" | "light";
  openTool: (id: string, input?: string) => void;
  goHome: () => void;
  toggleTheme: () => void;
  hydrate: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  route: { name: "home" },
  recents: [],
  theme: "dark",

  openTool(id, input) {
    const recents = [id, ...get().recents.filter((r) => r !== id)].slice(0, MAX_RECENTS);
    set({ route: { name: "tool", id, input }, recents });
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
