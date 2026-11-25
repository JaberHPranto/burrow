import { defineTool } from "@/core/tools/types";
import { Contrast } from "lucide-react";
import { lazy } from "react";
import { detectColor } from "./logic";

export default defineTool({
  id: "contrast-checker",
  name: "Contrast checker",
  description: "WCAG AA/AAA contrast for any two colours",
  category: "frontend",
  icon: Contrast,
  tone: "mint",
  keywords: ["wcag", "a11y", "accessibility", "color", "colour", "contrast"],
  component: lazy(() => import("./View")),
  detect: detectColor,
});
