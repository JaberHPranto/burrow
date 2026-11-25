#!/usr/bin/env bash
# Register GNOME custom keyboard shortcuts that drive Burrow.
#
# Global hotkeys can't be grabbed by apps on Wayland, so GNOME runs
# `burrow --toggle` / `burrow --tool <id>`; the running instance receives the
# arguments through the single-instance plugin.
#
# Usage:  scripts/setup-gnome-shortcuts.sh            (uses `burrow` from PATH)
#         BURROW_BIN=/path/to/burrow scripts/setup-gnome-shortcuts.sh
# Safe to re-run: existing Burrow shortcuts are updated, others are untouched.
# (Older versions also bound Ctrl+Alt+J to the JSON formatter; that entry is left as-is.)
set -euo pipefail

# Find Burrow: $BURROW_BIN, then an installed `burrow`, then a build in this repo.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="${BURROW_BIN:-$(command -v burrow || true)}"
if [[ -z "$BIN" ]]; then
  for candidate in "$REPO/src-tauri/target/release/burrow" "$REPO/src-tauri/target/debug/burrow"; do
    if [[ -x "$candidate" ]]; then
      BIN="$candidate"
      break
    fi
  done
fi
if [[ -z "$BIN" ]]; then
  echo "Burrow not found. Run 'npm run app:dev' once (or install the .deb), then re-run this script." >&2
  exit 1
fi
if [[ "$BIN" == */target/debug/burrow ]]; then
  echo "Using the dev build: $BIN"
  echo "Shortcuts work while 'npm run app:dev' is running. Install the .deb for always-on shortcuts."
  echo
fi

SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
KEY_SCHEMA="$SCHEMA.custom-keybinding"
BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"

# slug | name | command | binding
# Super+Space is avoided on purpose: GNOME uses it to switch input sources.
# Ctrl+Alt+T is avoided too (Ubuntu's terminal). `--run` starts the capture immediately.
SHORTCUTS=(
  "burrow-launcher|Burrow: launcher|$BIN --toggle|<Control><Alt>space"
  "burrow-screenshot|Burrow: screenshot|$BIN --tool screenshot --run|<Control><Alt>s"
  "burrow-ocr|Burrow: grab text (OCR)|$BIN --tool ocr --run|<Control><Alt>o"
  "burrow-color|Burrow: pick colour|$BIN --tool color-picker --run|<Control><Alt>c"
  "burrow-notes|Burrow: quick notes|$BIN --tool quick-notes|<Control><Alt>n"
)

current="$(gsettings get "$SCHEMA" custom-keybindings)"
[[ "$current" == "@as []" ]] && current="[]"

for entry in "${SHORTCUTS[@]}"; do
  IFS="|" read -r slug name command binding <<<"$entry"
  path="$BASE/$slug/"
  if [[ "$current" != *"'$path'"* ]]; then
    if [[ "$current" == "[]" ]]; then current="['$path']"; else current="${current%]}, '$path']"; fi
  fi
  gsettings set "$KEY_SCHEMA:$path" name "$name"
  gsettings set "$KEY_SCHEMA:$path" command "$command"
  gsettings set "$KEY_SCHEMA:$path" binding "$binding"
  printf '  %-22s %s\n' "$binding" "$name"
done

gsettings set "$SCHEMA" custom-keybindings "$current"
echo "Done. Change them any time in Settings → Keyboard → Custom Shortcuts."
