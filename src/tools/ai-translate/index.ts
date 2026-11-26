import { defineTool } from "@/core/tools/types";
import { Languages } from "lucide-react";
import { lazy } from "react";
import { detectForeignScript } from "./logic";

export default defineTool({
  id: "ai-translate",
  name: "Translate",
  description: "Translate text between English, Bangla and 16 other languages",
  category: "ai",
  icon: Languages,
  tone: "mint",
  keywords: ["translate", "translation", "language", "bangla", "bengali", "english", "ai"],
  tray: { label: "Translate clipboard", run: true },
  component: lazy(() => import("./View")),
  detect: detectForeignScript,
});
