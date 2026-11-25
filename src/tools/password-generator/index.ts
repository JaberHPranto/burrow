import { defineTool } from "@/core/tools/types";
import { KeyRound } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "password-generator",
  name: "Password generator",
  description: "Strong random passwords, generated locally",
  category: "generators",
  icon: KeyRound,
  tone: "butter",
  keywords: ["password", "secret", "random", "token"],
  component: lazy(() => import("./View")),
});
