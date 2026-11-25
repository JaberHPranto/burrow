# CLAUDE.md

Guidance for AI assistants (and humans) working on Burrow. Read this before changing code.

## What this is

Burrow is a Tauri 2 desktop app for Linux (Ubuntu/GNOME, Wayland-first): a
Spotlight-style launcher that hosts many small developer tools. React 19 + TypeScript
(strict) on the frontend, Rust for native access. Owner: a frontend developer, so
keep frontend code idiomatic and the Rust side small and well-commented.

## Commands

```bash
npm run check                 # typecheck + biome + vitest. Run before finishing any change.
npm run lint:fix              # format + autofix
npm run app:dev               # run the desktop app
npm run dev                   # UI only in a browser (native calls are mocked)
cd src-tauri && cargo test    # Rust unit tests
cd src-tauri && cargo clippy --all-targets -- -D warnings
```

A change is done when `npm run check` passes, plus `cargo test` and `cargo clippy` if Rust changed.

## Architecture (where things go)

| Path | Responsibility | Rules |
|---|---|---|
| `src/tools/<id>/` | One tool | Self-contained. Never import from another tool's folder. Shared code moves to `core/` or `design/`. |
| `src/tools/index.ts` | Tool catalogue | The only file to touch to register a tool. |
| `src/core/tools/` | `ToolDefinition` contract, registry | Changing the contract affects every tool, so keep it backwards compatible. |
| `src/core/platform/` | All Tauri access (commands, clipboard, events) | The **only** place allowed to import `@tauri-apps/*`. Every command needs a mock in `mocks.ts`. |
| `src/core/storage/` | Persistence | Use `usePersistentState(toolId, key, initial)`. Namespace = tool id. |
| `src/core/*` (color, fake, search, hooks) | Shared pure logic and hooks | Must be tested. If two tools need the same logic, it moves here. |
| `src/core/handoff.ts` | Pass data between tools | Key = `"<receiving-tool>:<what>"`, consumed once with `take`. |
| `src/core/platform/window.ts` | `useWindowSize(w, h, active)`, `overlayWindow` | Tools that need room (editor, schema mock) grow the window; size is restored on unmount. `overlayWindow` enters/exits fullscreen for region selection. |
| `src/core/deps/` | Optional system packages: catalogue, `reportFor` badge logic, status store | When a tool uses a system package, add it to `catalog.ts` + `commands/deps.rs` and list it in the tool's `requires`. Update the README dependency table. |
| `src/core/capture/` | Region selection overlay (`useSnip`), crop/decode helpers | Shared by Screenshot and OCR. Geometry is pure and tested. |
| `src/design/` | Design system | Tools import UI only from `@/design`. No raw colours: use tokens. |
| `src/features/` | Launcher and ToolHost | App chrome, not tools. |
| `src-tauri/src/commands/<tool>.rs` | Native code for one tool | Validate every argument. Return `crate::error::Result`. Add unit tests for parsing logic. |

## Adding a tool (checklist)

1. Create `src/tools/<id>/` (kebab-case id, never renamed later; it's used in CLI args and storage keys):
   - `logic.ts`: pure functions, no React or DOM. All behaviour lives here.
   - `logic.test.ts`: Vitest tests for `logic.ts`. Cover edge cases and errors.
   - `View.tsx`: `export default function X({ initialInput, autoRun }: ToolProps)`. Thin: state + layout.
     If the tool has a main action (capture, pick), start it when `autoRun` is true. Guard with a
     `useRef` so React StrictMode's double effect doesn't run it twice.
   - `styles.module.css`: optional, only for layout the design system doesn't cover.
   - `index.ts`: `export default defineTool({ id, name, description, category, icon, tone, keywords, component: lazy(() => import("./View")), detect?, requires? })`
     `requires` lists system packages (`{ id, level: "required" | "recommended" | "optional", why }`); missing ones
     get a launcher badge and an install banner automatically.
2. Add one import and one array entry in `src/tools/index.ts`.
3. If it can act on clipboard text, add `detect(text) → { score, label } | null`:
   - Pure and fast (it runs on every launcher open). Return null unless confident.
   - Scores: 0.9+ unambiguous (valid JSON, SVG), 0.6–0.8 likely, below 0.5 ignored.
   - Add a routing case to `src/core/tools/catalogue.test.ts`.
4. If it needs native access: add `src-tauri/src/commands/<capability>.rs`, register it in `lib.rs`
   `generate_handler!`, add a typed wrapper in `core/platform/commands.ts` and a mock in `mocks.ts`,
   and add a permission to `capabilities/default.json` only if a plugin needs one.
   - Binary data (images) goes as a raw body: `callRaw()` in TS, `tauri::ipc::Request` + `InvokeBody::Raw`
     in Rust; return bytes with `tauri::ipc::Response`. Never base64 or JSON arrays.
   - Anything that opens a portal or dialog must hold `window::SuppressBlur` so the launcher doesn't
     hide itself when focus moves to that dialog.
   - Portal cancellations surface as the error string "cancelled"; check with `isCancelled(err)`
     and stay silent.
5. Optional: tray quick action in `src-tauri/src/tray.rs` (`QUICK_TOOLS`, with a `run` flag) and a
   hotkey in `scripts/setup-gnome-shortcuts.sh` (`burrow --tool <id> --run`).
6. Update the tool table in `README.md`.

Use `src/tools/json-formatter/` as the reference implementation.

## Conventions

- **TypeScript:** strict + `noUncheckedIndexedAccess`. No `any`, no non-null `!`. Use the `@/` alias for imports outside the current folder.
- **Components:** function components, named exports, except a tool's `View.tsx`, which default-exports (for `lazy`).
- **State:** local `useState` first. Zustand (`src/app/store.ts`) only for app-wide state.
- **Styling:** design-system components first; CSS modules for tool-specific layout; `var(--token)` only. Classes in `design/components.css` are prefixed `b-` and used only through components (layout helpers `b-grow` are fine to use directly).
- **Copy:** friendly, short, with a light bunny/burrow tone in empty states only. Working UI stays plain.
- **Accessibility:** every icon-only button needs a `label`. Keyboard first: `Esc` = back (ToolHost handles it; call `e.preventDefault()` to keep it inside your tool).
- **Errors:** never let a tool crash the app. ToolHost has an error boundary, but handle expected failures with `<ErrorNote>` or `toast.error`.
- **Formatting:** Biome (2-space indent, double quotes, 100 cols). Don't hand-format; run `npm run lint:fix`.

## Security

- Treat clipboard, files and pasted content as untrusted. Sanitise HTML (`DOMPurify`, as in `markdown-viewer/render.ts`); render user SVG only via `<img src="data:…">`, never inline.
- Keep the CSP in `tauri.conf.json` strict. Don't add remote origins without a reason.
- Secrets (future AI keys) go in the system keyring, never in `burrow.json` or logs.
- Rust commands receive input from the webview, so validate it (see `cli.rs` id validation, `kill_process` pid check,
  `ocr.rs` language allow-list, size limits on raw bodies).
- The webview never passes file paths to write: `save_png` opens the save dialog itself and writes only
  to the path the user picked.
- Shell commands are spawned with argument arrays (`Command::new().arg()`), never through a shell.
- Keep `capabilities/default.json` minimal.

## Platform notes (Linux / Wayland)

- **Global hotkeys:** apps can't grab them on Wayland. GNOME custom shortcuts run `burrow --toggle` / `burrow --tool <id>`; `tauri-plugin-single-instance` forwards args to the running app (`cli.rs` → `window.rs`). Setup: `scripts/setup-gnome-shortcuts.sh`.
- **Tray:** GNOME delivers no click events to tray icons, only the menu. Put actions in the menu.
- **Screenshots:** whole-screen grab via `gnome-screenshot -f` (allow-listed by GNOME Shell → no dialog),
  falling back to `xdg-desktop-portal` via `ashpd` (`commands/capture.rs`), which on GNOME 42 asks
  "Share this screenshot?" each time for unsandboxed apps. Burrow hides, grabs the whole screen, then `core/capture/useSnip` shows it in a fullscreen
  overlay where the user drags a region (Flameshot-style). Tools call `snip.start({ withActions })` and
  render `snip.overlay`. Overlay keys are handled in the capture phase so `Esc` never reaches ToolHost.
  The desktop capture is split per monitor (`monitorRegions` + `getMonitorLayout`); the overlay shows the
  current monitor 1:1 on a device-pixel canvas (sharp on HiDPI) and `Tab` cycles monitors. View ↔ image
  mapping uses `containFit`.
- **Colour picking:** portal `PickColor` (GNOME's own eyedropper).
- **OCR:** system `tesseract` binary (`commands/ocr.rs`); the tool shows install instructions if missing.
- **Clipboard history (phase 3):** background clipboard watching isn't possible on GNOME Wayland. Plan: a small companion GNOME Shell extension that forwards copies to Burrow.
- **Launcher window:** frameless, always on top, skip taskbar, hides on blur in release builds only. Drag regions use `data-tauri-drag-region`.

## Screenshot editor internals

`src/tools/screenshot/`: `model.ts` (pure document + undo/redo reducer, geometry, hit-testing — tested),
`render.ts` (canvas drawing shared by view and export, so what you see is what you save),
`Editor.tsx` (pointer interaction), `View.tsx` (toolbar, shortcuts, copy/save/OCR).
Coordinates are image pixels; stroke sizes are chosen in screen pixels and converted with the view scale.
To add an annotation type: extend `Shape` in `model.ts` (+ `shapeBounds`, `hitTest`, `moveShape`),
draw it in `render.ts`, add a tool button in `View.tsx`.

## Roadmap

- Phase 2 ✅: screenshot + annotation editor, OCR, colour picker, tasks, schema mock
- Phase 3: emoji picker (emojibase), clipboard history (Shell extension)
- Phase 4: AI tools with BYOK (OpenAI-compatible client + Anthropic; keys in keyring; streaming UI)
- Settings screen (hotkeys, theme, autostart via `tauri-plugin-autostart`)
