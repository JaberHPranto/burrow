import type { Requirement } from "@/core/deps/catalog";
import type { Tone } from "@/design";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, LazyExoticComponent } from "react";

export type ToolCategory =
  | "capture"
  | "clipboard"
  | "notes"
  | "data"
  | "generators"
  | "frontend"
  | "system"
  | "ai";

/** Props every tool component receives from the host. */
export interface ToolProps {
  /**
   * Text to start with — set when the tool was opened from a clipboard
   * suggestion. Tools that take text input should seed their input with it.
   */
  initialInput?: string;
  /**
   * Start the tool's main action immediately — set when opened with
   * `burrow --tool <id> --run` (hotkeys, tray). E.g. the screenshot tool captures.
   */
  autoRun?: boolean;
}

/** Result of a clipboard detector: how confident, and what to call the action. */
export interface ClipboardMatch {
  /** 0–1. Suggestions below 0.5 are ignored. */
  score: number;
  /** Action label shown on the suggestion chip, e.g. "Format JSON". */
  label: string;
}

export interface ToolDefinition {
  /** kebab-case, unique, stable — used in `burrow --tool <id>` and storage keys. */
  id: string;
  name: string;
  /** One line, shown in the launcher. */
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  tone: Tone;
  /** Extra search terms. */
  keywords?: readonly string[];
  /** Lazily loaded so the launcher opens instantly. */
  component: LazyExoticComponent<ComponentType<ToolProps>>;
  /** System packages the tool uses. Missing ones show a badge and an install banner. */
  requires?: readonly Requirement[];
  /** Optional: recognise clipboard text this tool can act on. Must be fast and pure. */
  detect?: (text: string) => ClipboardMatch | null;
}

/** Identity helper that gives tool definitions full type checking. */
export const defineTool = (definition: ToolDefinition): ToolDefinition => definition;

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  capture: "Capture",
  clipboard: "Clipboard",
  notes: "Notes & tasks",
  data: "Data",
  generators: "Generators",
  frontend: "Frontend",
  system: "System",
  ai: "AI",
};

/** Display order of categories in the launcher. */
export const CATEGORY_ORDER: readonly ToolCategory[] = [
  "capture",
  "clipboard",
  "notes",
  "data",
  "generators",
  "frontend",
  "system",
  "ai",
];
