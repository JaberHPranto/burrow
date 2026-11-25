/**
 * Typed wrappers around Rust `#[tauri::command]`s. Every native call goes
 * through here so tools never touch `invoke` or command names directly.
 * In a dev browser each command returns mock data (see ./mocks.ts).
 */
import { mocks } from "./mocks";
import { isTauri } from "./runtime";

export interface ListeningPort {
  port: number;
  address: string;
  protocol: "tcp" | "tcp6";
  pid: number | null;
  process: string | null;
  command: string | null;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) return mocks.handle<T>(command, args);
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export const commands = {
  listListeningPorts: () => call<ListeningPort[]>("list_listening_ports"),
  killProcess: (pid: number, force = false) => call<void>("kill_process", { pid, force }),
  hideLauncher: () => call<void>("hide_launcher"),
  /** Tool requested with `burrow --tool <id>` on a cold start, if any. */
  takePendingTool: () => call<string | null>("take_pending_tool"),
};
