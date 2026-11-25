import { useEffect, useRef, useState } from "react";
import { storage } from "./storage";

/**
 * useState that loads from and saves to persistent storage (debounced).
 * `loaded` is false until the stored value has been read.
 */
export function usePersistentState<T>(
  namespace: string,
  key: string,
  initial: T,
  debounceMs = 300,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const store = useRef(storage.scope(namespace)).current;

  useEffect(() => {
    let alive = true;
    store.get<T>(key).then((stored) => {
      if (!alive) return;
      if (stored !== undefined) setValue(stored);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [store, key]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void store.set(key, value), debounceMs);
    return () => clearTimeout(t);
  }, [loaded, store, key, value, debounceMs]);

  return [value, setValue, loaded];
}
