import { useSyncExternalStore } from "react";
import { resolveTheme } from "./settings";
import { useSettings } from "./store";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const prefersDarkNow = () => darkQuery().matches;
function subscribe(onChange: () => void) {
  const q = darkQuery();
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}

/** The theme actually shown: the user's choice, with "system" following the desktop. */
export function useResolvedTheme(): "dark" | "light" {
  const pref = useSettings((s) => s.settings.theme);
  const prefersDark = useSyncExternalStore(subscribe, prefersDarkNow);
  return resolveTheme(pref, prefersDark);
}
