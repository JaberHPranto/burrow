<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" alt="Burrow bunny" />
</p>

<h1 align="center">Burrow</h1>

<p align="center">A cozy burrow of developer utilities for Linux — one hotkey away.</p>

Burrow lives in your tray. Press a hotkey, type a few letters, hit Enter. It also
peeks at your clipboard and suggests the right tool: copy JSON and it offers
**Format JSON**, copy a hex colour and it offers **Check contrast**.

Built with **Tauri 2 + React 19 + TypeScript**. Everything runs locally.

---

## Tools

| Tool | What it does | Clipboard trigger |
|---|---|---|
| **Quick notes** | Scratchpad that saves as you type; pin and search | — |
| **Markdown viewer** | Split edit/preview, open `.md` files, copy HTML | Markdown |
| **JSON formatter** | Validate with line/column errors, prettify, minify, sort keys | `{…}` / `[…]` |
| **Password generator** | Crypto-secure, unbiased, entropy meter | — |
| **Lorem & fake data** | Paragraphs, people (JSON), names, emails, UUIDs | — |
| **Contrast checker** | WCAG 2.2 AA/AAA for normal and large text | `#hex`, `rgb()`, `hsl()` |
| **Palette from image** | Paste/drop/open an image → palette as HEX, CSS vars or Tailwind | — |
| **CSS generators** | Box-shadow (multi-layer), gradients, cubic-bezier with live preview | — |
| **SVG optimizer → JSX** | SVGO + typed React component output | `<svg>…</svg>` |
| **Port inspector** | Who's listening on which port, with one-click stop | — |
| **.env diff** | Missing / empty / undocumented keys vs `.env.example` | `KEY=value` lines |

### Roadmap

| Phase | Tools | Notes |
|---|---|---|
| **1 ✅** | Launcher, clipboard suggestions, the 11 tools above | No special permissions needed |
| **2** | Screenshot + annotation editor, OCR capture, colour picker | Via `xdg-desktop-portal` (Wayland-safe) + local Tesseract |
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
scripts/setup-gnome-shortcuts.sh
```

| Shortcut | Action |
|---|---|
| `Ctrl` `Alt` `Space` | Toggle the launcher |
| `Ctrl` `Alt` `N` | Quick notes |
| `Ctrl` `Alt` `J` | JSON formatter |

Any tool can be bound: `burrow --tool <id>` (ids are the folder names in `src/tools/`).

Inside Burrow: `↑` `↓` to move, `Enter` to open, `Esc` to go back or close.

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
│   ├── color/           Shared colour maths (WCAG, parsing, conversion)
│   ├── search/          Fuzzy scorer
│   └── hooks/           Shared hooks (list navigation, image paste/drop)
├── design/              PawsDev design system: tokens, components, Bunny mascot
├── features/            Launcher and tool host (the frame around every tool)
└── tools/<id>/          One folder per tool — index.ts, logic.ts (+ test), View.tsx

src-tauri/src/
├── lib.rs               Plugins, command registration, setup
├── cli.rs               --toggle / --tool parsing
├── window.rs            Show / hide / toggle, events to the frontend
├── tray.rs              Tray menu
└── commands/            One module per tool that needs native access
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
