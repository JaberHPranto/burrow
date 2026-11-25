/** Fake command responses for browser-only UI development. Never used in the app. */
import type {
  AiProviderId,
  ClipboardBridgeStatus,
  HotkeysState,
  ListeningPort,
  OcrStatus,
  OpenToolRequest,
  PickedColor,
} from "./commands";

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

/** Draw a fake "desktop" so the screenshot editor has something to edit. */
async function fakeScreenshot(): Promise<ArrayBuffer> {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const grad = ctx.createLinearGradient(0, 0, 1280, 800);
  grad.addColorStop(0, "#2b3a4a");
  grad.addColorStop(1, "#5b4b6b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 800);
  // window
  ctx.fillStyle = "#1f222a";
  ctx.fillRect(160, 110, 960, 580);
  ctx.fillStyle = "#30343e";
  ctx.fillRect(160, 110, 960, 40);
  for (const [i, c] of ["#f28b82", "#f8e192", "#88cca6"].entries()) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(185 + i * 22, 130, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = "22px monospace";
  const lines = [
    ["#a8dadc", "export async function login(email, password) {"],
    ["#eceef2", "  const res = await fetch('/api/auth/login', {"],
    ["#eceef2", "    method: 'POST', body: JSON.stringify({ email })"],
    ["#eceef2", "  });"],
    ["#f28b82", "  // TODO: password is never sent!"],
    ["#eceef2", "  return res.json();"],
    ["#a8dadc", "}"],
  ] as const;
  lines.forEach(([color, text], i) => {
    ctx.fillStyle = color;
    ctx.fillText(text, 200, 210 + i * 44);
  });
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("toBlob failed");
  return blob.arrayBuffer();
}

const hotkeys: HotkeysState = {
  supported: true,
  hotkeys: [
    { id: "launcher", name: "Burrow: launcher", binding: "<Control><Alt>space" },
    { id: "screenshot", name: "Burrow: screenshot", binding: "<Control><Alt>s" },
    { id: "ocr", name: "Burrow: grab text (OCR)", binding: "<Control><Alt>o" },
    { id: "color", name: "Burrow: pick colour", binding: "<Control><Alt>c" },
    { id: "clipboard", name: "Burrow: clipboard history", binding: null },
    { id: "emoji", name: "Burrow: emoji picker", binding: null },
    { id: "tasks", name: "Burrow: tasks", binding: null },
    { id: "notes", name: "Burrow: quick notes", binding: "<Control><Alt>n" },
    { id: "settings", name: "Burrow: settings", binding: null },
  ],
};
const aiKeys: Record<AiProviderId, boolean> = {
  openai: false,
  anthropic: true,
  openrouter: false,
  ollama: false,
  custom: false,
};
let bridge: ClipboardBridgeStatus = {
  installed: false,
  enabled: false,
  lastSeenSecsAgo: null,
  shellVersion: 42,
};

type Handler = (args?: Record<string, unknown>) => unknown;

const handlers: Record<string, Handler> = {
  list_listening_ports: () => ports,
  kill_process: (args) => {
    ports = ports.filter((p) => p.pid !== args?.pid);
  },
  hide_launcher: () => undefined,
  set_hide_on_blur: () => undefined,
  app_data_dir: () => "/home/you/.local/share/dev.burrow.app",
  save_json: (args) =>
    `/home/you/Documents/${String(args?.["x-file-name"] ?? "burrow-backup.json")}`,
  get_hotkeys: () => structuredClone(hotkeys), // real IPC returns a fresh copy
  set_hotkey: (args) => {
    const hk = hotkeys.hotkeys.find((h) => h.id === args?.id);
    if (hk) hk.binding = (args?.binding as string | null) ?? null;
  },
  ai_key_status: () => ({ ...aiKeys }),
  ai_set_key: (args) => {
    aiKeys[args?.provider as AiProviderId] = true;
  },
  ai_delete_key: (args) => {
    aiKeys[args?.provider as AiProviderId] = false;
  },
  ai_test: (args) =>
    aiKeys[args?.provider as AiProviderId] || args?.provider === "ollama"
      ? {
          ok: true,
          message: "Connected · 3 models",
          models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
        }
      : { ok: false, message: "No API key saved yet.", models: [] },
  clipboard_bridge_status: () => bridge,
  install_clipboard_extension: () => {
    bridge = { ...bridge, installed: true, enabled: true };
    return "Installed. Log out and back in once so GNOME loads it.";
  },
  uninstall_clipboard_extension: () => {
    bridge = { ...bridge, installed: false, enabled: false };
  },
  take_pending_tool: (): OpenToolRequest | null => null,
  capture_screenshot: () => fakeScreenshot(),
  pick_color: (): PickedColor => ({ r: 136, g: 204, b: 166 }),
  // Pretend gnome-screenshot is missing so the badge UI is visible in browser dev.
  check_dependencies: () => [
    { id: "gnome-screenshot", installed: false },
    { id: "portal", installed: true },
    { id: "tesseract", installed: true },
    { id: "tesseract-ben", installed: false },
  ],
  ocr_status: (): OcrStatus => ({ available: true, languages: ["ben", "eng"] }),
  ocr_image: () =>
    "export async function login(email, password) {\n  const res = await fetch('/api/auth/login', {\n    method: 'POST', body: JSON.stringify({ email })\n  });\n  // TODO: password is never sent!\n  return res.json();\n}\n",
  save_png: (args) =>
    `/home/you/Pictures/Screenshots/${String(args?.["x-file-name"] ?? "burrow.png")}`,
};

export const mocks = {
  async handle<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const handler = handlers[command];
    if (!handler) throw new Error(`No mock for command "${command}"`);
    await new Promise((r) => setTimeout(r, 120));
    return (await handler(args)) as T;
  },
};
