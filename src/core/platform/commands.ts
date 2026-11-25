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

export interface OpenToolRequest {
  id: string;
  /** Start the tool's main action right away (e.g. capture). */
  run: boolean;
}

export interface OcrStatus {
  available: boolean;
  languages: string[];
}

export interface HotkeyInfo {
  id: string;
  name: string;
  /** GNOME accelerator like `<Control><Alt>s`, or null when unbound. */
  binding: string | null;
}

export interface HotkeysState {
  supported: boolean;
  hotkeys: HotkeyInfo[];
}

export type AiProviderId = "openai" | "anthropic" | "openrouter" | "ollama" | "custom";

export interface AiTestResult {
  ok: boolean;
  message: string;
  models: string[];
}

/** How the window behaves; mirrors `WindowMode` in `src-tauri/src/window.rs`. */
export type WindowMode = "launcher" | "pinned" | "normal";

export interface WindowModeResult {
  /** False when Pinned can't keep the window on top (Wayland without the GNOME extension). */
  keepAbove: boolean;
}

export interface ClipboardBridgeStatus {
  installed: boolean;
  /** Installed but older than this Burrow ships (no window helper yet). */
  outdated: boolean;
  enabled: boolean;
  lastSeenSecsAgo: number | null;
  shellVersion: number | null;
}

export interface PickedColor {
  r: number;
  g: number;
  b: number;
}

/** The user dismissed a portal dialog. Tools should treat this as "do nothing". */
export const isCancelled = (err: unknown) => String(err).includes("cancelled");

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) return mocks.handle<T>(command, args);
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Send raw bytes as the request body (no JSON encoding) — for images. */
async function callRaw<T>(
  command: string,
  bytes: Uint8Array,
  headers: Record<string, string>,
): Promise<T> {
  if (!isTauri()) return mocks.handle<T>(command, { bytes, ...headers });
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, bytes, { headers });
}

export const commands = {
  listListeningPorts: () => call<ListeningPort[]>("list_listening_ports"),
  killProcess: (pid: number, force = false) => call<void>("kill_process", { pid, force }),
  hideLauncher: () => call<void>("hide_launcher"),
  /** Tool requested with `burrow --tool <id>` on a cold start, if any. */
  takePendingTool: () => call<OpenToolRequest | null>("take_pending_tool"),

  /**
   * PNG bytes of a screen capture. Default: the whole screen, silently, leaving
   * the window hidden so a selection overlay can take over (see core/capture).
   * `interactive` shows GNOME's own screenshot dialog instead.
   */
  captureScreenshot: async (opts: { interactive?: boolean; reshow?: boolean } = {}) =>
    new Uint8Array(
      await call<ArrayBuffer>("capture_screenshot", {
        interactive: opts.interactive ?? false,
        reshow: opts.reshow ?? false,
      }),
    ),
  pickColor: () => call<PickedColor>("pick_color"),
  // ---- Settings
  setWindowMode: (mode: WindowMode) => call<WindowModeResult>("set_window_mode", { mode }),
  appDataDir: () => call<string>("app_data_dir"),
  saveJson: (json: string, fileName: string) =>
    callRaw<string | null>("save_json", new TextEncoder().encode(json), {
      "x-file-name": fileName,
    }),
  getHotkeys: () => call<HotkeysState>("get_hotkeys"),
  setHotkey: (id: string, binding: string | null) => call<void>("set_hotkey", { id, binding }),
  aiKeyStatus: () => call<Record<AiProviderId, boolean>>("ai_key_status"),
  aiSetKey: (provider: AiProviderId, key: string) => call<void>("ai_set_key", { provider, key }),
  aiDeleteKey: (provider: AiProviderId) => call<void>("ai_delete_key", { provider }),
  aiTest: (provider: AiProviderId, baseUrl: string | null) =>
    call<AiTestResult>("ai_test", { provider, baseUrl }),
  clipboardBridgeStatus: () => call<ClipboardBridgeStatus>("clipboard_bridge_status"),
  installClipboardExtension: () => call<string>("install_clipboard_extension"),
  uninstallClipboardExtension: () => call<void>("uninstall_clipboard_extension"),

  /** Which optional system packages are installed (see core/deps/catalog.ts). */
  checkDependencies: () => call<Array<{ id: string; installed: boolean }>>("check_dependencies"),

  ocrStatus: () => call<OcrStatus>("ocr_status"),
  ocrImage: (bytes: Uint8Array, lang: string) =>
    callRaw<string>("ocr_image", bytes, { "x-ocr-lang": lang }),

  /** Opens a native save dialog; resolves to the saved path or null if cancelled. */
  savePng: (bytes: Uint8Array, fileName: string) =>
    callRaw<string | null>("save_png", bytes, { "x-file-name": fileName }),
};
