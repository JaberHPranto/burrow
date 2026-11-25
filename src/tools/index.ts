/**
 * The tool catalogue. To add a tool: create `src/tools/<id>/` (see CLAUDE.md)
 * and add one import + one array entry here. Order = default launcher order
 * within each category.
 */
import type { ToolDefinition } from "@/core/tools/types";
import contrastChecker from "./contrast-checker";
import cssGenerators from "./css-generators";
import envDiff from "./env-diff";
import fakeData from "./fake-data";
import jsonFormatter from "./json-formatter";
import markdownViewer from "./markdown-viewer";
import paletteFromImage from "./palette-from-image";
import passwordGenerator from "./password-generator";
import portInspector from "./port-inspector";
import quickNotes from "./quick-notes";
import svgTools from "./svg-tools";

export const tools: readonly ToolDefinition[] = [
  // notes
  quickNotes,
  markdownViewer,
  // data
  jsonFormatter,
  // generators
  passwordGenerator,
  fakeData,
  // frontend
  contrastChecker,
  paletteFromImage,
  cssGenerators,
  svgTools,
  // system
  portInspector,
  envDiff,
];
