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
  entries(): Promise<Array<[string, unknown]>>;
  clear(): Promise<void>;
  /** Write to disk now (the Tauri store otherwise autosaves after a short delay). */
  flush(): Promise<void>;
}

const PREFIX = "burrow:";

const browserBackend: Backend = {
  async get<T>(key: string) {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  },
  async set(key, value) {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  },
  async entries() {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map(
        (k) =>
          [k.slice(PREFIX.length), JSON.parse(localStorage.getItem(k) ?? "null")] as [
            string,
            unknown,
          ],
      );
  },
  async clear() {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  },
  async flush() {},
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
        entries: () => store.entries<unknown>(),
        clear: () => store.clear(),
        flush: () => store.save(),
      };
    })();
  }
  return backendPromise;
}

export interface ScopedStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** Backup file format — see Settings → Data. */
export interface Backup {
  app: "burrow";
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** Keys look like "<namespace>.<key>"; anything else in a backup is ignored. */
const VALID_KEY = /^[a-z0-9-]+\.[A-Za-z0-9_-]+$/;

export function parseBackup(json: string): Backup {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== "object") throw new Error("Not a Burrow backup");
  const b = value as Partial<Backup>;
  if (b.app !== "burrow" || b.version !== 1 || !b.data || typeof b.data !== "object") {
    throw new Error("Not a Burrow backup (or from a newer version)");
  }
  const data = Object.fromEntries(Object.entries(b.data).filter(([k]) => VALID_KEY.test(k)));
  return { app: "burrow", version: 1, exportedAt: String(b.exportedAt ?? ""), data };
}

export const storage = {
  /** Everything Burrow stores (settings + tool data). API keys are in the keyring, not here. */
  async exportAll(): Promise<Backup> {
    const data = Object.fromEntries(await (await backend()).entries());
    return { app: "burrow", version: 1, exportedAt: new Date().toISOString(), data };
  },
  /** Replace all data with a backup's. */
  async importAll(backup: Backup): Promise<void> {
    const b = await backend();
    await b.clear();
    for (const [k, v] of Object.entries(backup.data)) await b.set(k, v);
    await b.flush();
  },
  async clearAll(): Promise<void> {
    const b = await backend();
    await b.clear();
    await b.flush();
  },

  scope(namespace: string): ScopedStorage {
    return {
      get: async <T>(key: string) => (await backend()).get<T>(`${namespace}.${key}`),
      set: async (key, value) => (await backend()).set(`${namespace}.${key}`, value),
    };
  },
};
