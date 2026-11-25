import { defineTool } from "@/core/tools/types";
import { MessageCircleQuestion } from "lucide-react";
import { lazy } from "react";
import { detectError } from "./logic";

export default defineTool({
  id: "ai-explain",
  name: "Explain code or error",
  description: "What this code does, or why this error happens and how to fix it",
  category: "ai",
  icon: MessageCircleQuestion,
  tone: "coral",
  keywords: ["explain", "error", "stack trace", "exception", "debug", "code", "regex", "log", "ai"],
  component: lazy(() => import("./View")),
  detect: detectError,
});
