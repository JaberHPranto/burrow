/**
 * The tool catalogue. To add a tool: create `src/tools/<id>/` (see CLAUDE.md)
 * and add one import + one array entry here. Order = default launcher order
 * within each category.
 */
import type { ToolDefinition } from "@/core/tools/types";
import settings from "@/features/settings/definition";
import aiGrammar from "./ai-grammar";
import aiMessage from "./ai-message";
import aiRewrite from "./ai-rewrite";
import aiSummarize from "./ai-summarize";
import aiTranslate from "./ai-translate";
import clipboardHistory from "./clipboard-history";
import colorPicker from "./color-picker";
import emojiPicker from "./emoji-picker";
import envDiff from "./env-diff";
import fakeData from "./fake-data";
import jsonFormatter from "./json-formatter";
import markdownViewer from "./markdown-viewer";
import ocr from "./ocr";
import paletteFromImage from "./palette-from-image";
import passwordGenerator from "./password-generator";
import portInspector from "./port-inspector";
import quickNotes from "./quick-notes";
import schemaMock from "./schema-mock";
import screenshot from "./screenshot";
import svgTools from "./svg-tools";
import tasks from "./tasks";

export const tools: readonly ToolDefinition[] = [
  // capture
  screenshot,
  ocr,
  colorPicker,
  // clipboard
  clipboardHistory,
  emojiPicker,
  // notes & tasks
  tasks,
  quickNotes,
  markdownViewer,
  // data
  jsonFormatter,
  schemaMock,
  // generators
  passwordGenerator,
  fakeData,
  // frontend
  paletteFromImage,
  svgTools,
  // system
  portInspector,
  envDiff,
  // ai
  aiSummarize,
  aiGrammar,
  aiRewrite,
  aiMessage,
  aiTranslate,
  // app
  settings,
];
