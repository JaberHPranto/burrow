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
  requires: [
    { id: "tesseract", level: "required", why: "reads the text in images" },
    {
      id: "gnome-screenshot",
      level: "recommended",
      why: "captures without GNOME's “Share this screenshot?” dialog",
    },
    { id: "tesseract-ben", level: "optional", why: "adds Bangla text recognition" },
  ],
  component: lazy(() => import("./View")),
});
