import { defineTool } from "@/core/tools/types";
import { FileJson } from "lucide-react";
import { lazy } from "react";
import { detectSchema } from "./source";

export default defineTool({
  id: "schema-mock",
  name: "Schema → mock request",
  description: "Request bodies from JSON Schema, OpenAPI or an example, as JSON / cURL / fetch",
  category: "data",
  icon: FileJson,
  tone: "butter",
  keywords: [
    "mock",
    "schema",
    "json schema",
    "openapi",
    "swagger",
    "request",
    "body",
    "api",
    "payload",
    "curl",
    "postman",
  ],
  component: lazy(() => import("./View")),
  detect: detectSchema,
});
