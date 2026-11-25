/**
 * Small persistent key-value store.
 * - App: `@tauri-apps/plugin-store` → ~/.local/share/dev.burrow.app/burrow.json
 * - Browser dev: localStorage
 *
 * Keys are namespaced per tool: `storage.scope("quick-notes").get("notes")`.
 */
import { isTauri } from "../platform/runtime";

interface Backend {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const browserBackend: Backend = {
  async get<T>(key: string) {
    const raw = localStorage.getItem(`burrow:${key}`);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  },
  async set(key, value) {
    localStorage.setItem(`burrow:${key}`, JSON.stringify(value));
  },
};

let backendPromise: Promise<Backend> | null = null;

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (!isTauri()) return browserBackend;
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("burrow.json", { autoSave: 300, defaults: {} });
      return {
        get: <T>(key: string) => store.get<T>(key),
        set: (key: string, value: unknown) => store.set(key, value),
      };
    })();
  }
  return backendPromise;
}

export interface ScopedStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export const storage = {
  scope(namespace: string): ScopedStorage {
    return {
      get: async <T>(key: string) => (await backend()).get<T>(`${namespace}.${key}`),
      set: async (key, value) => (await backend()).set(`${namespace}.${key}`, value),
    };
  },
};
