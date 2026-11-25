import { defineTool } from "@/core/tools/types";
import { FileText } from "lucide-react";
import { lazy } from "react";
import { detectMarkdown } from "./logic";

export default defineTool({
  id: "markdown-viewer",
  name: "Markdown viewer",
  description: "Preview and edit Markdown side by side",
  category: "notes",
  icon: FileText,
  tone: "aqua",
  keywords: ["markdown", "md", "readme", "preview", "docs"],
  component: lazy(() => import("./View")),
  detect: detectMarkdown,
});
