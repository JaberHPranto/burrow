/**
 * Settings → Tray: which tools the tray menu shows. Pure: no React, no Tauri.
 */
import type { TrayItem } from "@/core/platform/commands";
import { MAX_TRAY_ITEMS } from "@/core/settings/settings";
import type { ToolDefinition } from "@/core/tools/types";

/** Always in the tray menu (as "Settings…"), so not offered as a choice. */
const FIXED = new Set(["settings"]);

/** Tools that can be added to the tray. */
export function trayCandidates(tools: readonly ToolDefinition[]): ToolDefinition[] {
  return tools.filter((t) => !FIXED.has(t.id));
}

/**
 * The chosen tool ids → menu items, in catalogue order (so the menu reads like
 * the launcher). Ids of tools that no longer exist are skipped.
 */
export function trayItems(ids: readonly string[], tools: readonly ToolDefinition[]): TrayItem[] {
  const chosen = new Set(ids);
  return trayCandidates(tools)
    .filter((t) => chosen.has(t.id))
    .slice(0, MAX_TRAY_ITEMS)
    .map((t) => ({ id: t.id, label: t.tray?.label ?? t.name, run: t.tray?.run ?? false }));
}

/** Toggle a tool in the tray selection (respecting the limit). */
export function toggleTray(ids: readonly string[], id: string, on: boolean): string[] {
  const without = ids.filter((x) => x !== id);
  if (!on) return without;
  return without.length >= MAX_TRAY_ITEMS ? [...ids] : [...without, id];
}
