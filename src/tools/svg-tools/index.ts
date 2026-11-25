import { defineTool } from "@/core/tools/types";
import { Shapes } from "lucide-react";
import { lazy } from "react";
import { detectSvg } from "./jsx";

export default defineTool({
  id: "svg-tools",
  name: "SVG optimizer → JSX",
  description: "Shrink SVGs with SVGO and turn them into React components",
  category: "frontend",
  icon: Shapes,
  tone: "coral",
  keywords: ["svg", "svgo", "jsx", "tsx", "react", "icon", "optimize", "minify"],
  component: lazy(() => import("./View")),
  detect: detectSvg,
});
