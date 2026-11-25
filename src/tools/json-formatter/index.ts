import { defineTool } from "@/core/tools/types";
import { Braces } from "lucide-react";
import { lazy } from "react";
import { detectJson } from "./logic";

export default defineTool({
  id: "json-formatter",
  name: "JSON formatter",
  description: "Validate, prettify, minify and sort JSON",
  category: "data",
  icon: Braces,
  tone: "mint",
  keywords: ["json", "validate", "pretty", "minify", "lint"],
  component: lazy(() => import("./View")),
  detect: detectJson,
});
