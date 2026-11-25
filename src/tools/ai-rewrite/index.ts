import { defineTool } from "@/core/tools/types";
import { PenLine } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "ai-rewrite",
  name: "Rewrite",
  description: "Make text clearer, shorter, friendlier, more formal or more casual",
  category: "ai",
  icon: PenLine,
  tone: "butter",
  keywords: ["rewrite", "rephrase", "paraphrase", "tone", "shorter", "formal", "polish", "ai"],
  component: lazy(() => import("./View")),
});
