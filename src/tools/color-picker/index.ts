import { defineTool } from "@/core/tools/types";
import { Pipette } from "lucide-react";
import { lazy } from "react";
import { detectColor } from "./logic";

export default defineTool({
  id: "color-picker",
  name: "Colour picker",
  description: "Pick any pixel on screen; copy as HEX, RGB, HSL or OKLCH",
  category: "capture",
  icon: Pipette,
  tone: "butter",
  keywords: ["color", "colour", "picker", "eyedropper", "hex", "rgb", "hsl", "oklch"],
  requires: [{ id: "portal", level: "required", why: "provides GNOME's on-screen colour picker" }],
  component: lazy(() => import("./View")),
  detect: detectColor,
});
