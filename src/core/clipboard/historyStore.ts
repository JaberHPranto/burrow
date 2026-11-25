/**
 * Clipboard history state, recorded app-wide (not only while the tool is open):
 * - from the GNOME Shell extension via the `burrow://clipboard` event
 * - from the clipboard read each time the launcher opens (works without the extension)
 */
import { useSettings } from "@/core/settings/store";
import { storage } from "@/core/storage/storage";
import { create } from "zustand";
import { type ClipItem, type ClipSource, addClip, trim } from "./history";

const scope = storage.scope("clipboard-history");
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persist(items: ClipItem[]) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void scope.set("items", items), 400);
}

interface HistoryState {
  items: ClipItem[];
  loaded: boolean;
  load: () => Promise<void>;
  record: (text: string, source: ClipSource) => void;
  togglePin: (id: string) => void;
  remove: (id: string) => void;
  clearUnpinned: () => void;
}

export const useClipHistory = create<HistoryState>((set, get) => {
  const commit = (items: ClipItem[]) => {
    set({ items });
    persist(items);
  };

  return {
    items: [],
    loaded: false,

    async load() {
      const items = (await scope.get<ClipItem[]>("items")) ?? [];
      set({ items: Array.isArray(items) ? items : [], loaded: true });
    },

    record(text, source) {
      const { clipboard } = useSettings.getState().settings;
      if (!clipboard.enabled || !get().loaded) return;
      const next = addClip(get().items, text, {
        maxItems: clipboard.maxItems,
        ignoreSecrets: clipboard.ignoreSecrets,
        source,
      });
      // addClip returns a fresh array even when nothing changed; skip no-op writes.
      if (next.length !== get().items.length || next[0]?.at !== get().items[0]?.at) commit(next);
    },

    togglePin(id) {
      commit(get().items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)));
    },

    remove(id) {
      commit(get().items.filter((i) => i.id !== id));
    },

    clearUnpinned() {
      commit(
        trim(
          get().items.filter((i) => i.pinned),
          Number.POSITIVE_INFINITY,
        ),
      );
    },
  };
});
