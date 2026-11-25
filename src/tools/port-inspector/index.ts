import { defineTool } from "@/core/tools/types";
import { Network } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "port-inspector",
  name: "Port inspector",
  description: "What's listening on :3000? See it and stop it",
  category: "system",
  icon: Network,
  tone: "mint",
  keywords: ["port", "lsof", "kill", "process", "listen", "localhost", "eaddrinuse"],
  component: lazy(() => import("./View")),
});
