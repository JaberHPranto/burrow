import { defineTool } from "@/core/tools/types";
import { FileDiff } from "lucide-react";
import { lazy } from "react";
import { detectEnv } from "./logic";

export default defineTool({
  id: "env-diff",
  name: ".env diff",
  description: "Find keys missing from .env vs .env.example",
  category: "system",
  icon: FileDiff,
  tone: "coral",
  keywords: ["env", "dotenv", "example", "config", "variables", "compare"],
  component: lazy(() => import("./View")),
  detect: detectEnv,
});
