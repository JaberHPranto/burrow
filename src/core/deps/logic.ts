import {
  DEPENDENCIES,
  type Dependency,
  type DependencyId,
  type Requirement,
  type RequirementLevel,
} from "./catalog";

export type DependencyStatus = Partial<Record<DependencyId, boolean>>;

export interface MissingRequirement extends Requirement {
  dependency: Dependency;
}

export interface ToolDependencyReport {
  /** Missing packages that deserve attention (required + recommended), most severe first. */
  missing: MissingRequirement[];
  /** Missing optional extras. */
  extras: MissingRequirement[];
  /** Worst level among `missing`, or null if nothing important is missing. */
  level: Exclude<RequirementLevel, "optional"> | null;
  /** One `sudo apt install …` line covering `missing` + `extras`, or "" if nothing is missing. */
  installCommand: string;
}

const EMPTY: ToolDependencyReport = { missing: [], extras: [], level: null, installCommand: "" };

/**
 * What's missing for a tool. Unknown status (not checked yet, or a browser
 * dev session) counts as installed, so we never show a false alarm.
 */
export function reportFor(
  requires: readonly Requirement[] | undefined,
  status: DependencyStatus | null,
): ToolDependencyReport {
  if (!requires?.length || !status) return EMPTY;
  const absent = requires
    .filter((r) => status[r.id] === false)
    .map((r) => ({ ...r, dependency: DEPENDENCIES[r.id] }));
  const missing = absent
    .filter((r) => r.level !== "optional")
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "required" ? -1 : 1));
  const extras = absent.filter((r) => r.level === "optional");
  const packages = [...new Set(absent.flatMap((r) => r.dependency.apt.split(" ")))];
  return {
    missing,
    extras,
    level: missing[0] ? (missing[0].level as "required" | "recommended") : null,
    installCommand: packages.length ? `sudo apt install ${packages.join(" ")}` : "",
  };
}
