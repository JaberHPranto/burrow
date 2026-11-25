import { defineTool } from "@/core/tools/types";
import { Paintbrush } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "css-generators",
  name: "CSS generators",
  description: "Box-shadow, gradient and cubic-bezier with live preview",
  category: "frontend",
  icon: Paintbrush,
  tone: "aqua",
  keywords: ["css", "shadow", "gradient", "bezier", "easing", "animation", "transition"],
  component: lazy(() => import("./View")),
});
