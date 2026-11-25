/**
 * Optional system packages and what they unlock. Keep in sync with
 * `src-tauri/src/commands/deps.rs` (which checks them) and the README's
 * "Dependencies" table.
 */

export type DependencyId = "gnome-screenshot" | "portal" | "tesseract" | "tesseract-ben";

export interface Dependency {
  id: DependencyId;
  /** Human name shown in badges. */
  name: string;
  /** apt package(s) to install. */
  apt: string;
}

export const DEPENDENCIES: Record<DependencyId, Dependency> = {
  "gnome-screenshot": { id: "gnome-screenshot", name: "gnome-screenshot", apt: "gnome-screenshot" },
  portal: { id: "portal", name: "GNOME desktop portal", apt: "xdg-desktop-portal-gnome" },
  tesseract: { id: "tesseract", name: "Tesseract", apt: "tesseract-ocr tesseract-ocr-eng" },
  "tesseract-ben": { id: "tesseract-ben", name: "Bangla OCR data", apt: "tesseract-ocr-ben" },
};

/**
 * How much a tool depends on a package:
 * - required:    the tool can't work without it (red badge)
 * - recommended: works, but worse without it (yellow badge)
 * - optional:    extra feature; mentioned in the tool, no badge
 */
export type RequirementLevel = "required" | "recommended" | "optional";

export interface Requirement {
  id: DependencyId;
  level: RequirementLevel;
  /** Short reason shown in the tool's banner, e.g. "reads text from images". */
  why: string;
}
