import { useClipHistory } from "@/core/clipboard/historyStore";
import { useDeps } from "@/core/deps/store";
import { type OpenToolRequest, commands } from "@/core/platform/commands";
import { EVENTS, onEvent } from "@/core/platform/events";
import { useSettings } from "@/core/settings/store";
import { useResolvedTheme } from "@/core/settings/useResolvedTheme";
import { registry } from "@/core/tools/registry";
import { trayItems } from "@/core/tray/tray";
import { Toaster } from "@/design";
import { Launcher } from "@/features/launcher/Launcher";
import { ToolHost } from "@/features/tool-host/ToolHost";
import { useEffect } from "react";
import { useApp } from "./store";

export function App() {
  const route = useApp((s) => s.route);
  const theme = useResolvedTheme();
  const loadSettings = useSettings((s) => s.load);
  const loadHistory = useClipHistory((s) => s.load);
  const recordClip = useClipHistory((s) => s.record);
  const openTool = useApp((s) => s.openTool);
  const hydrate = useApp((s) => s.hydrate);
  const refreshDeps = useDeps((s) => s.refresh);
  const settingsLoaded = useSettings((s) => s.loaded);
  const trayIds = useSettings((s) => s.settings.tray);

  // Check optional packages at startup and whenever the launcher is shown
  // (cheap: a few PATH lookups), so badges clear right after an install.
  useEffect(() => {
    void refreshDeps();
    const unlisten = onEvent(EVENTS.shown, () => void refreshDeps());
    return () => void unlisten.then((fn) => fn());
  }, [refreshDeps]);

  useEffect(() => {
    void (async () => {
      await Promise.all([hydrate(), loadSettings(), loadHistory()]);
      // Cold start via `burrow --tool <id>`: Rust parked the request until we were ready.
      const pending = await commands.takePendingTool();
      if (pending) openTool(pending.id, { autoRun: pending.run });
    })();
  }, [hydrate, loadSettings, loadHistory, openTool]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Tray menu: the tools chosen in Settings → Tray (Rust shows defaults until then).
  useEffect(() => {
    if (!settingsLoaded) return;
    void commands.setTrayItems(trayItems(trayIds, registry.all())).catch(() => {});
  }, [settingsLoaded, trayIds]);

  // Clipboard history: copies forwarded by the GNOME Shell extension.
  useEffect(() => {
    const unlisten = onEvent<string>(EVENTS.clipboard, (text) => recordClip(text, "extension"));
    return () => void unlisten.then((fn) => fn());
  }, [recordClip]);

  // `burrow --tool <id>` (hotkeys, tray menu) → open that tool.
  useEffect(() => {
    const unlisten = onEvent<OpenToolRequest>(EVENTS.openTool, (req) =>
      openTool(req.id, { autoRun: req.run }),
    );
    return () => void unlisten.then((fn) => fn());
  }, [openTool]);

  return (
    <>
      {route.name === "home" ? (
        <Launcher onClose={() => void commands.hideLauncher()} />
      ) : (
        <ToolHost
          key={`${route.id}:${route.nonce}`}
          id={route.id}
          input={route.input}
          autoRun={route.autoRun}
        />
      )}
      <Toaster />
    </>
  );
}
