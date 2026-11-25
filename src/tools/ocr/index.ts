import { defineTool } from "@/core/tools/types";
import { ScanText } from "lucide-react";
import { lazy } from "react";

export default defineTool({
  id: "ocr",
  name: "OCR capture",
  description: "Select any part of the screen and copy its text (runs locally)",
  category: "capture",
  icon: ScanText,
  tone: "aqua",
  keywords: ["ocr", "text", "extract", "tesseract", "scan", "read", "copy text", "image to text"],
  component: lazy(() => import("./View")),
});
