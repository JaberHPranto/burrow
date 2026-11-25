import { defineTool } from "@/core/tools/types";
import { Palette } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "palette-from-image",
  name: "Palette from image",
  description: "Pull the main colours out of a screenshot or photo",
  category: "frontend",
  icon: Palette,
  tone: "butter",
  keywords: ["palette", "colors", "colours", "extract", "image", "theme", "tailwind"],
  component: lazy(() => import("./View")),
});
