import { defineTool } from "@/core/tools/types";
import { SmilePlus } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "emoji-picker",
  name: "Emoji picker",
  description: "Search every emoji by name or :shortcode:, pick a skin tone, copy",
  category: "clipboard",
  icon: SmilePlus,
  tone: "butter",
  keywords: ["emoji", "emoticon", "smiley", "unicode", "shortcode", "gitmoji", "symbols"],
  component: lazy(() => import("./View")),
});
