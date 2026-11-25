import { useClipHistory } from "@/core/clipboard/historyStore";
import { type Suggestion, suggestForClipboard } from "@/core/clipboard/suggest";
import { clipboard } from "@/core/platform/clipboard";
import { EVENTS, onEvent } from "@/core/platform/events";
import { useSettings } from "@/core/settings/store";
import { registry } from "@/core/tools/registry";
import { useEffect, useState } from "react";

export interface ClipboardSuggestions {
  text: string;
  suggestions: Suggestion[];
}

/** Reads the clipboard on mount and every time the launcher is shown. */
export function useClipboardSuggestions(): ClipboardSuggestions {
  const [state, setState] = useState<ClipboardSuggestions>({ text: "", suggestions: [] });

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const text = await clipboard.readText();
      if (!alive) return;
      // AI tools only suggest themselves once a provider is set up.
      const aiReady = useSettings.getState().settings.ai.defaultProvider !== null;
      const tools = registry.all().filter((t) => aiReady || t.category !== "ai");
      setState({ text, suggestions: suggestForClipboard(text, tools) });
      // Without the GNOME extension this is how clipboard history learns about copies.
      if (text) useClipHistory.getState().record(text, "launcher");
    };
    void refresh();
    const unlisten = onEvent(EVENTS.shown, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("focus", refresh);
      void unlisten.then((fn) => fn());
    };
  }, []);

  return state;
}
