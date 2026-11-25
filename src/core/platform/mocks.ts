/** Fake command responses for browser-only UI development. Never used in the app. */
import type { ListeningPort } from "./commands";

let ports: ListeningPort[] = [
  {
    port: 1420,
    address: "127.0.0.1",
    protocol: "tcp",
    pid: 41022,
    process: "node",
    command: "node vite",
  },
  {
    port: 3000,
    address: "0.0.0.0",
    protocol: "tcp",
    pid: 38110,
    process: "next-server",
    command: "next dev",
  },
  { port: 5432, address: "127.0.0.1", protocol: "tcp", pid: null, process: null, command: null },
  {
    port: 8000,
    address: "::",
    protocol: "tcp6",
    pid: 39001,
    process: "uvicorn",
    command: "uvicorn app.main:app --reload",
  },
];

const handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {
  list_listening_ports: () => ports,
  kill_process: (args) => {
    ports = ports.filter((p) => p.pid !== args?.pid);
  },
  hide_launcher: () => undefined,
  take_pending_tool: () => null,
};

export const mocks = {
  async handle<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const handler = handlers[command];
    if (!handler) throw new Error(`No mock for command "${command}"`);
    await new Promise((r) => setTimeout(r, 120));
    return handler(args) as T;
  },
};
