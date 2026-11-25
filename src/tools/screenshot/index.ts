import { defineTool } from "@/core/tools/types";
import { Camera } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "screenshot",
  name: "Screenshot",
  description: "Capture an area and annotate it with arrows, boxes, steps and blur",
  category: "capture",
  icon: Camera,
  tone: "coral",
  keywords: ["screenshot", "capture", "annotate", "arrow", "markup", "snip", "screen", "image"],
  requires: [
    {
      id: "gnome-screenshot",
      level: "recommended",
      why: "captures without GNOME's “Share this screenshot?” dialog",
    },
  ],
  component: lazy(() => import("./View")),
});
