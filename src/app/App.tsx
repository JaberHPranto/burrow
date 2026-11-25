import { commands } from "@/core/platform/commands";
import { EVENTS, onEvent } from "@/core/platform/events";
import { Toaster } from "@/design";
import { Launcher } from "@/features/launcher/Launcher";
import { ToolHost } from "@/features/tool-host/ToolHost";
import { useEffect } from "react";
import { useApp } from "./store";

export function App() {
  const route = useApp((s) => s.route);
  const theme = useApp((s) => s.theme);
  const openTool = useApp((s) => s.openTool);
  const hydrate = useApp((s) => s.hydrate);

  useEffect(() => {
    void (async () => {
      await hydrate();
      // Cold start via `burrow --tool <id>`: Rust parked the request until we were ready.
      const pending = await commands.takePendingTool();
      if (pending) openTool(pending);
    })();
  }, [hydrate, openTool]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // `burrow --tool <id>` (hotkeys, tray menu) → open that tool.
  useEffect(() => {
    const unlisten = onEvent<string>(EVENTS.openTool, (id) => openTool(id));
    return () => void unlisten.then((fn) => fn());
  }, [openTool]);

  return (
    <>
      {route.name === "home" ? (
        <Launcher onClose={() => void commands.hideLauncher()} />
      ) : (
        <ToolHost key={route.id} id={route.id} input={route.input} />
      )}
      <Toaster />
    </>
  );
}
