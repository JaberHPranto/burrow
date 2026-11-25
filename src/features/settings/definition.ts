import { defineTool } from "@/core/tools/types";
import { Settings } from "lucide-react";
import { lazy } from "react";

/**
 * Settings is app chrome, not a tool, but registering it like one makes it
 * searchable in the launcher and reachable via `burrow --tool settings`, the
 * tray and hotkeys. Pass a section id as input to open it there ("hotkeys", "ai"…).
 */
export default defineTool({
  id: "settings",
  name: "Settings",
  description: "Hotkeys, AI keys, clipboard history, appearance and data",
  category: "app",
  icon: Settings,
  tone: "aqua",
  keywords: [
    "settings",
    "preferences",
    "config",
    "hotkeys",
    "shortcuts",
    "api key",
    "theme",
    "backup",
  ],
  component: lazy(() => import("./SettingsView")),
});
