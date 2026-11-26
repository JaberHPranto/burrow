import { defineTool } from "@/core/tools/types";
import { SpellCheck } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "ai-grammar",
  name: "Fix grammar",
  description: "Fix spelling, grammar and punctuation; keeps your voice and formatting",
  category: "ai",
  icon: SpellCheck,
  tone: "aqua",
  keywords: ["grammar", "spelling", "spell check", "proofread", "typo", "correct", "fix", "ai"],
  tray: { label: "Fix grammar of clipboard", run: true },
  component: lazy(() => import("./View")),
});
