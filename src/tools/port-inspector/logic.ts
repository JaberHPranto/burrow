import type { ListeningPort } from "@/core/platform/commands";

/** Friendly hints for ports developers see every day. */
const WELL_KNOWN: Record<number, string> = {
  1420: "Tauri dev",
  3000: "Next.js / React",
  3306: "MySQL",
  4200: "Angular",
  5000: "Flask",
  5173: "Vite",
  5432: "PostgreSQL",
  5672: "RabbitMQ",
  6006: "Storybook",
  6379: "Redis",
  8000: "FastAPI / Django",
  8080: "HTTP alt",
  9200: "Elasticsearch",
  9229: "Node inspector",
  27017: "MongoDB",
};

export function portHint(port: number): string | null {
  return WELL_KNOWN[port] ?? null;
}

export function filterPorts(ports: readonly ListeningPort[], query: string): ListeningPort[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ports];
  return ports.filter((p) =>
    [String(p.port), p.address, p.process ?? "", p.command ?? "", portHint(p.port) ?? ""].some(
      (field) => field.toLowerCase().includes(q),
    ),
  );
}

/** Is this socket reachable from other machines? */
export function isPublic(address: string): boolean {
  return address === "0.0.0.0" || address === "::";
}
