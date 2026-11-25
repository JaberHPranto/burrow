import { defineTool } from "@/core/tools/types";
import { NotebookPen } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "quick-notes",
  name: "Quick notes",
  description: "A scratchpad that saves as you type",
  category: "notes",
  icon: NotebookPen,
  tone: "butter",
  keywords: ["notes", "scratchpad", "todo", "memo", "jot"],
  component: lazy(() => import("./View")),
});
