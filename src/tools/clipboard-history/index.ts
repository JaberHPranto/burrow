import { defineTool } from "@/core/tools/types";
import { ClipboardList } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "clipboard-history",
  name: "Clipboard history",
  description: "Everything you've copied — search, pin and copy again",
  category: "clipboard",
  icon: ClipboardList,
  tone: "aqua",
  keywords: ["clipboard", "history", "copied", "paste", "pasteboard", "clips"],
  component: lazy(() => import("./View")),
});
