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
| `src/core/*` (color, search, hooks) | Shared pure logic and hooks | Must be tested. |
| `src/design/` | Design system | Tools import UI only from `@/design`. No raw colours: use tokens. |
| `src/features/` | Launcher and ToolHost | App chrome, not tools. |
| `src-tauri/src/commands/<tool>.rs` | Native code for one tool | Validate every argument. Return `crate::error::Result`. Add unit tests for parsing logic. |

## Adding a tool (checklist)

1. Create `src/tools/<id>/` (kebab-case id, never renamed later; it's used in CLI args and storage keys):
   - `logic.ts`: pure functions, no React or DOM. All behaviour lives here.
   - `logic.test.ts`: Vitest tests for `logic.ts`. Cover edge cases and errors.
   - `View.tsx`: `export default function X({ initialInput }: ToolProps)`. Thin: state + layout.
   - `styles.module.css`: optional, only for layout the design system doesn't cover.
   - `index.ts`: `export default defineTool({ id, name, description, category, icon, tone, keywords, component: lazy(() => import("./View")), detect? })`
2. Add one import and one array entry in `src/tools/index.ts`.
3. If it can act on clipboard text, add `detect(text) → { score, label } | null`:
   - Pure and fast (it runs on every launcher open). Return null unless confident.
   - Scores: 0.9+ unambiguous (valid JSON, SVG), 0.6–0.8 likely, below 0.5 ignored.
   - Add a routing case to `src/core/tools/catalogue.test.ts`.
4. If it needs native access: add `src-tauri/src/commands/<tool>.rs`, register it in `lib.rs`
   `generate_handler!`, add a typed wrapper in `core/platform/commands.ts` and a mock in `mocks.ts`,
   and add a permission to `capabilities/default.json` only if a plugin needs one.
5. Optional: tray quick action in `src-tauri/src/tray.rs` (`QUICK_TOOLS`).
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
- Rust commands receive input from the webview, so validate it (see `cli.rs` id validation, `kill_process` pid check).
- Keep `capabilities/default.json` minimal.

## Platform notes (Linux / Wayland)

- **Global hotkeys:** apps can't grab them on Wayland. GNOME custom shortcuts run `burrow --toggle` / `burrow --tool <id>`; `tauri-plugin-single-instance` forwards args to the running app (`cli.rs` → `window.rs`). Setup: `scripts/setup-gnome-shortcuts.sh`.
- **Tray:** GNOME delivers no click events to tray icons, only the menu. Put actions in the menu.
- **Screenshots / colour picking (phase 2):** use `xdg-desktop-portal` (Screenshot, PickColor), not X11 APIs.
- **Clipboard history (phase 3):** background clipboard watching isn't possible on GNOME Wayland. Plan: a small companion GNOME Shell extension that forwards copies to Burrow.
- **Launcher window:** frameless, always on top, skip taskbar, hides on blur in release builds only. Drag regions use `data-tauri-drag-region`.

## Roadmap

- Phase 2: screenshot + annotation editor (Konva), OCR (local Tesseract), colour picker (portal)
- Phase 3: emoji picker (emojibase), clipboard history (Shell extension)
- Phase 4: AI tools with BYOK (OpenAI-compatible client + Anthropic; keys in keyring; streaming UI)
- Settings screen (hotkeys, theme, autostart via `tauri-plugin-autostart`)
