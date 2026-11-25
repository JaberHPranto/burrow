import { defineTool } from "@/core/tools/types";
import { MessageSquareText } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "ai-message",
  name: "Write a message",
  description: "Turn rough notes into a natural message for Slack, a WhatsApp group or a DM",
  category: "ai",
  icon: MessageSquareText,
  tone: "coral",
  keywords: [
    "message",
    "slack",
    "whatsapp",
    "dm",
    "chat",
    "reply",
    "team",
    "announce",
    "write",
    "ai",
  ],
  component: lazy(() => import("./View")),
});
