import type { ListeningPort } from "@/core/platform/commands";
import { describe, expect, it } from "vitest";
import { filterPorts, isPublic, portHint } from "./logic";

const ports: ListeningPort[] = [
  { port: 3000, address: "0.0.0.0", protocol: "tcp", pid: 1, process: "node", command: "next dev" },
  { port: 5432, address: "127.0.0.1", protocol: "tcp", pid: null, process: null, command: null },
];

describe("port inspector", () => {
  it("filters by port, process, command and hint", () => {
    expect(filterPorts(ports, "3000")).toHaveLength(1);
    expect(filterPorts(ports, "next")).toHaveLength(1);
    expect(filterPorts(ports, "postgres")).toHaveLength(1);
    expect(filterPorts(ports, "")).toHaveLength(2);
  });

  it("knows common dev ports and public binds", () => {
    expect(portHint(5173)).toBe("Vite");
    expect(portHint(1)).toBeNull();
    expect(isPublic("0.0.0.0")).toBe(true);
    expect(isPublic("127.0.0.1")).toBe(false);
  });
});
