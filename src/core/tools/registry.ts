import { tools } from "@/tools";
import { scoreFields } from "../search/fuzzy";
import type { ToolDefinition } from "./types";

const byId = new Map(tools.map((t) => [t.id, t] as const));

if (import.meta.env.DEV && byId.size !== tools.length) {
  throw new Error("Duplicate tool id in src/tools/index.ts");
}

export const registry = {
  all: (): readonly ToolDefinition[] => tools,

  get: (id: string): ToolDefinition | undefined => byId.get(id),

  /** Tools matching the query, best first. */
  search(query: string): ToolDefinition[] {
    if (!query.trim()) return [...tools];
    return tools
      .map((tool) => ({
        tool,
        score: scoreFields(query, [tool.name, ...(tool.keywords ?? []), tool.description]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.tool);
  },
};
