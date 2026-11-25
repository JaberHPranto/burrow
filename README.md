<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Burrow bunny" />
</p>

<h1 align="center">Burrow</h1>

<p align="center">A cozy burrow of developer utilities for Linux — one hotkey away.</p>

Burrow lives in your tray. Press a hotkey, type a few letters, hit Enter. It also
peeks at your clipboard and suggests the right tool: copy JSON and it offers
**Format JSON**, copy a JSON Schema and it offers **Mock data from schema**.

Built with **Tauri 2 + React 19 + TypeScript**. Everything runs locally.

---

## Tools

| Tool | What it does | Clipboard trigger |
|---|---|---|
| **Screenshot** | Drag over any part of the screen (no dialog), then **Copy**, **Save** or **Annotate** (arrow, box, ellipse, highlight, pixelate, text, numbered steps, crop) | — |
| **OCR capture** | Drag over any text on screen and get it as text — local Tesseract, English/Bangla | — |
| **Colour picker** | Pick any pixel on screen → HEX, RGB, HSL, OKLCH; recent picks | `#hex`, `rgb()`, `hsl()` |
| **Tasks** | Personal to-dos. Quick add: `Review PR !high #work tomorrow`. Today / Upcoming / tags | — |
| **Quick notes** | Scratchpad that saves as you type; pin and search | — |
| **Markdown viewer** | Split edit/preview, open `.md` files, copy HTML | Markdown |
| **JSON formatter** | Validate with line/column errors, prettify, minify, sort keys | `{…}` / `[…]` |
| **Schema → mock request** | Request bodies from JSON Schema, OpenAPI (pick an operation) or an example payload; output as JSON, cURL, fetch or HTTPie | JSON Schema / OpenAPI |
| **Password generator** | Crypto-secure, unbiased, entropy meter | — |
| **Lorem & fake data** | Paragraphs, people (JSON), names, emails, UUIDs | — |
| **Palette from image** | Paste/drop/open an image → palette as HEX, CSS vars or Tailwind | — |
| **SVG optimizer → JSX** | SVGO + typed React component output | `<svg>…</svg>` |
| **Port inspector** | Who's listening on which port, with one-click stop | — |
| **.env diff** | Missing / empty / undocumented keys vs `.env.example` | `KEY=value` lines |

**Tasks quick-add syntax:** `!high` `!med` `!low` (or `!1` `!2` `!3`, `!!!`), `#tag`, and a date:
`today`, `tomorrow`/`tmr`, a weekday (`fri`), `next week`, `in 3 days`, `in 2w`, `dec 5`, `2026-12-01`.

**Schema mock** understands `type`, `properties`/`required`, `items`, `enum`, `const`, `format`
(email, uuid, date-time, uri, …), string length, number ranges and `multipleOf`, `nullable`,
`allOf`/`oneOf`/`anyOf` and local `$ref`s. Field names steer values (`email`, `price`, `city`,
`createdAt`…), and an `email` next to a `name` matches it.

### Roadmap

| Phase | Tools | Notes |
|---|---|---|
| **1 ✅** | Launcher, clipboard suggestions, core dev tools | No special permissions needed |
| **2 ✅** | Screenshot + annotation editor, OCR capture, colour picker, tasks, schema mock | Capture via `xdg-desktop-portal` (Wayland-safe); OCR via local Tesseract |
| **3** | Emoji picker, clipboard history | Clipboard history on GNOME Wayland needs a small companion Shell extension |
| **4** | AI: summarize, grammar, rewrite, explain code/error, OCR → AI | Bring your own key (OpenAI, Anthropic, OpenRouter, Ollama); keys in the system keyring |

---

## Getting started

### Prerequisites (Ubuntu 22.04+)

```bash
# Tauri system libraries
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node 20+ (via nvm, fnm, or your package manager)
```

For OCR (optional): `sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-ben`.
For dialog-free screenshots: `sudo apt install gnome-screenshot`. GNOME lets only its own screenshot
helper capture silently; without it Burrow falls back to the screenshot portal, which on Ubuntu 22.04
asks "Share this screenshot?" every time. The colour picker uses the portal (no prompt).

For the tray icon on GNOME, make sure the AppIndicator extension is on
(Ubuntu ships it enabled): `gnome-extensions enable ubuntu-appindicators@ubuntu.com`.

### Run

```bash
npm install
npm run app:dev        # Tauri app with hot reload
```

Dev builds don't hide on blur, so devtools stay usable (right-click → Inspect).

**UI-only mode:** `npm run dev` and open http://localhost:1420 in a browser.
The platform layer swaps native calls for mock data, which is handy for styling work.

### Build & install

```bash
npm run app:build      # → src-tauri/target/release/bundle/{deb,appimage}/
sudo apt install ./src-tauri/target/release/bundle/deb/Burrow_*.deb
```

### Hotkeys

Wayland doesn't let apps grab global shortcuts, so GNOME runs Burrow's CLI instead:

```bash
scripts/setup-gnome-shortcuts.sh   # finds an installed burrow, or your dev build
```

| Shortcut | Action |
|---|---|
| `Ctrl` `Alt` `Space` | Toggle the launcher |
| `Ctrl` `Alt` `S` | Screenshot → annotate |
| `Ctrl` `Alt` `O` | Grab text (OCR) |
| `Ctrl` `Alt` `C` | Pick a colour |
| `Ctrl` `Alt` `N` | Quick notes |

Any tool can be bound: `burrow --tool <id>` (ids are the folder names in `src/tools/`).
Add `--run` to start its main action immediately (capture, pick).
The tray menu has the same quick actions.

Inside Burrow: `↑` `↓` to move, `Enter` to open, `Esc` to go back or close.

**Selection overlay keys:** drag to select · `Space` / double-click whole screen · `Tab` next monitor · `Enter` copy ·
`Ctrl+S` save · `E` annotate · `Esc` cancel.

**Screenshot editor keys:** `V` select/move · `A` arrow · `R` box · `E` ellipse · `H` highlight ·
`B` pixelate · `T` text · `N` numbered step · `C` crop · `Del` delete · `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo ·
`Ctrl+C` copy image · `Ctrl+S` save.

---

## Architecture

```
src/
├── app/                 App shell + global store (route, recents, theme)
├── core/
│   ├── tools/           Tool contract (types.ts) + registry (search, lookup)
│   ├── clipboard/       Clipboard → tool suggestions
│   ├── platform/        The ONLY place that talks to Tauri (commands, clipboard, events, mocks)
│   ├── storage/         Persistent key-value store + usePersistentState
│   ├── color/           Shared colour maths (parsing, conversion, OKLCH)
│   ├── fake/            Seeded fake-data primitives (shared by generator tools)
│   ├── handoff.ts       Pass data between tools (e.g. screenshot → OCR)
│   ├── search/          Fuzzy scorer
│   └── hooks/           Shared hooks (list navigation, image paste/drop)
├── design/              PawsDev design system: tokens, components, Bunny mascot
├── features/            Launcher and tool host (the frame around every tool)
└── tools/<id>/          One folder per tool — index.ts, logic.ts (+ test), View.tsx

src-tauri/src/
├── lib.rs               Plugins, command registration, setup
├── cli.rs               --toggle / --tool parsing
├── window.rs            Show / hide / toggle, open-tool events, blur guard
├── tray.rs              Tray menu
└── commands/            capture (portal screenshot + colour), ocr (tesseract),
                         files (save dialog), ports (/proc), app
```

**Design rules**
- **Tools are plugins.** A tool is a folder plus one line in `src/tools/index.ts`. It's lazy-loaded, so the launcher stays instant.
- **Logic is pure and tested.** Every tool keeps its behaviour in `logic.ts` with a Vitest suite; views stay thin.
- **One door to native.** Tools never call `invoke` directly; they use `core/platform/commands.ts`, which also provides browser mocks.
- **Design tokens only.** Colours, type and spacing come from `design/tokens.css`. No raw hex in components.
- **Least privilege.** Tauri capabilities list only what's used; Rust commands validate their inputs.

See [CLAUDE.md](CLAUDE.md) for conventions and a step-by-step "add a tool" guide.

## Scripts

| Command | |
|---|---|
| `npm run app:dev` | Run the desktop app |
| `npm run app:build` | Build `.deb` + AppImage |
| `npm run dev` | UI only, in the browser with mocks |
| `npm run check` | Typecheck + lint + tests |
| `npm test` | Vitest |
| `npm run lint:fix` | Biome format + autofix |
| `cd src-tauri && cargo test` | Rust tests |

## Design

PawsDev palette: mint `#88CCA6`, butter `#F8E192`, aqua `#A8DADC`, coral `#F28B82`
on ink `#181A20`. Type: Outfit (display), Plus Jakarta Sans (body), JetBrains Mono (labels and code).
Dark is the default. The light theme uses the hand-drawn look: ink outlines and offset shadows.
