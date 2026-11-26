import { defineTool } from "@/core/tools/types";
import { ScrollText } from "lucide-react";
import { lazy } from "react";
import { detectLongProse } from "./logic";

export default defineTool({
  id: "ai-summarize",
  name: "Summarise",
  description: "Key points, a one-liner or a detailed summary of any text",
  category: "ai",
  icon: ScrollText,
  tone: "mint",
  keywords: ["summarize", "summarise", "summary", "tldr", "tl;dr", "digest", "ai", "key points"],
  tray: { label: "Summarise clipboard", run: true },
  component: lazy(() => import("./View")),
  detect: detectLongProse,
});
