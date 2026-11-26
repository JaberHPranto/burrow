//! Global hotkeys as GNOME custom keyboard shortcuts (via `gsettings`).
//!
//! Wayland doesn't let apps grab keys, so GNOME runs `burrow <args>` and the
//! single-instance plugin forwards the args to the running app. The webview
//! only picks an action id and a key binding — the command line is built here
//! from a fixed table, so the frontend can never register arbitrary commands.

use std::process::Command;

use serde::Serialize;

use crate::error::{Error, Result};

const SCHEMA: &str = "org.gnome.settings-daemon.plugins.media-keys";
const KEY_SCHEMA: &str = "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding";
const BASE: &str = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings";

struct Action {
    id: &'static str,
    name: &'static str,
    args: &'static [&'static str],
}

/// Path slugs match `scripts/setup-gnome-shortcuts.sh` (`burrow-<id>`), so
/// shortcuts made by the script show up here and vice versa.
const ACTIONS: &[Action] = &[
    Action { id: "launcher", name: "Burrow: launcher", args: &["--toggle"] },
    Action { id: "screenshot", name: "Burrow: screenshot", args: &["--tool", "screenshot", "--run"] },
    Action { id: "ocr", name: "Burrow: grab text (OCR)", args: &["--tool", "ocr", "--run"] },
    Action { id: "color", name: "Burrow: pick colour", args: &["--tool", "color-picker", "--run"] },
    Action { id: "clipboard", name: "Burrow: clipboard history", args: &["--tool", "clipboard-history"] },
    Action { id: "emoji", name: "Burrow: emoji picker", args: &["--tool", "emoji-picker"] },
    // AI tools run straight away on whatever is on the clipboard.
    Action { id: "ai-grammar", name: "Burrow: fix grammar of clipboard", args: &["--tool", "ai-grammar", "--run"] },
    Action { id: "ai-summarize", name: "Burrow: summarise clipboard", args: &["--tool", "ai-summarize", "--run"] },
    Action { id: "ai-translate", name: "Burrow: translate clipboard", args: &["--tool", "ai-translate", "--run"] },
    Action { id: "ai-message", name: "Burrow: write a message", args: &["--tool", "ai-message"] },
    Action { id: "tasks", name: "Burrow: tasks", args: &["--tool", "tasks"] },
    Action { id: "notes", name: "Burrow: quick notes", args: &["--tool", "quick-notes"] },
    Action { id: "settings", name: "Burrow: settings", args: &["--tool", "settings"] },
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hotkey {
    id: &'static str,
    name: &'static str,
    /// GNOME accelerator, e.g. `<Control><Alt>s`. None when unbound.
    binding: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeysState {
    /// False when not on GNOME (no gsettings / schema).
    supported: bool,
    hotkeys: Vec<Hotkey>,
}

fn gsettings(args: &[&str]) -> Result<String> {
    let out = Command::new("gsettings").args(args).output()?;
    if !out.status.success() {
        return Err(Error::Message(String::from_utf8_lossy(&out.stderr).trim().to_owned()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
}

fn path_for(id: &str) -> String {
    format!("{BASE}/burrow-{id}/")
}

/// Parse a GVariant string list like `['/a/', '/b/']` or `@as []`.
fn parse_list(text: &str) -> Vec<String> {
    text.split('\'').skip(1).step_by(2).map(String::from).collect()
}

fn format_list(items: &[String]) -> String {
    let quoted: Vec<String> = items.iter().map(|i| format!("'{i}'")).collect();
    format!("[{}]", quoted.join(", "))
}

/// Strip GVariant string quotes: `'<Control>a'` → `<Control>a`.
fn unquote(text: &str) -> String {
    text.trim().trim_matches('\'').to_owned()
}

const NAMED_KEYS: &[&str] = &[
    "space", "Return", "Tab", "Print", "comma", "period", "slash", "minus", "equal", "grave", "semicolon",
    "apostrophe", "bracketleft", "bracketright", "backslash", "Home", "End", "Page_Up", "Page_Down", "Insert",
    "Delete", "Up", "Down", "Left", "Right",
];
const MODIFIERS: &[&str] = &["Control", "Primary", "Alt", "Shift", "Super"];

/// Accept `<Mod>…<Mod>key` with known modifiers and keys. A modifier is
/// required unless the key is a function key or Print.
pub fn is_valid_accelerator(accel: &str) -> bool {
    if accel.len() > 64 {
        return false;
    }
    let mut rest = accel;
    let mut mods = 0;
    while let Some(stripped) = rest.strip_prefix('<') {
        let Some((m, after)) = stripped.split_once('>') else { return false };
        if !MODIFIERS.contains(&m) {
            return false;
        }
        mods += 1;
        rest = after;
    }
    let is_fkey = rest
        .strip_prefix('F')
        .and_then(|n| n.parse::<u8>().ok())
        .is_some_and(|n| (1..=12).contains(&n));
    let key_ok = is_fkey
        || NAMED_KEYS.contains(&rest)
        || (rest.len() == 1 && rest.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
    key_ok && (mods > 0 || is_fkey || rest == "Print")
}

/// Quote for GLib's shell-style argument parsing (used by GNOME to run the command).
fn shell_quote(arg: &str) -> String {
    if arg.chars().all(|c| c.is_ascii_alphanumeric() || "-_./=".contains(c)) {
        arg.to_owned()
    } else {
        format!("'{}'", arg.replace('\'', r"'\''"))
    }
}

/// While Burrow runs, reinstalling it (a package upgrade) replaces its file, and Linux then
/// reports its own path as "/usr/bin/burrow (deleted)". That suffix isn't part of the path:
/// the new version lives at the plain path, which is what a shortcut should run.
fn without_deleted_suffix(path: &str) -> &str {
    path.strip_suffix(" (deleted)").unwrap_or(path)
}

fn command_for(action: &Action) -> Result<String> {
    let exe = std::env::current_exe()?;
    let exe = exe.to_string_lossy();
    let mut parts = vec![shell_quote(without_deleted_suffix(&exe))];
    parts.extend(action.args.iter().map(|a| shell_quote(a)));
    Ok(parts.join(" "))
}

#[tauri::command]
pub async fn get_hotkeys() -> HotkeysState {
    tauri::async_runtime::spawn_blocking(|| {
        let Ok(list) = gsettings(&["get", SCHEMA, "custom-keybindings"]) else {
            return HotkeysState { supported: false, hotkeys: vec![] };
        };
        let registered = parse_list(&list);
        let hotkeys = ACTIONS
            .iter()
            .map(|a| {
                let path = path_for(a.id);
                let binding = registered
                    .contains(&path)
                    .then(|| gsettings(&["get", &format!("{KEY_SCHEMA}:{path}"), "binding"]).ok())
                    .flatten()
                    .map(|b| unquote(&b))
                    .filter(|b| !b.is_empty());
                Hotkey { id: a.id, name: a.name, binding }
            })
            .collect();
        HotkeysState { supported: true, hotkeys }
    })
    .await
    .unwrap_or(HotkeysState { supported: false, hotkeys: vec![] })
}

/// Bind (`Some`) or remove (`None`) the shortcut for one action.
#[tauri::command]
pub async fn set_hotkey(id: String, binding: Option<String>) -> Result<()> {
    let action = ACTIONS
        .iter()
        .find(|a| a.id == id)
        .ok_or_else(|| Error::Message(format!("Unknown action \"{id}\"")))?;
    if let Some(b) = &binding {
        if !is_valid_accelerator(b) {
            return Err(Error::Message(format!("\"{b}\" isn't a valid shortcut")));
        }
    }
    let command = command_for(action)?;

    tauri::async_runtime::spawn_blocking(move || {
        let path = path_for(action.id);
        let mut list = parse_list(&gsettings(&["get", SCHEMA, "custom-keybindings"])?);
        let key = format!("{KEY_SCHEMA}:{path}");
        match binding {
            Some(binding) => {
                gsettings(&["set", &key, "name", action.name])?;
                gsettings(&["set", &key, "command", &command])?;
                gsettings(&["set", &key, "binding", &binding])?;
                if !list.contains(&path) {
                    list.push(path);
                }
            }
            None => {
                gsettings(&["reset", &key, "binding"])?;
                list.retain(|p| p != &path);
            }
        }
        gsettings(&["set", SCHEMA, "custom-keybindings", &format_list(&list)])?;
        Ok(())
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_accelerators() {
        for ok in ["<Control><Alt>space", "<Super>v", "<Control><Shift>4", "F9", "Print", "<Alt>F2", "<Primary>comma"] {
            assert!(is_valid_accelerator(ok), "{ok}");
        }
        for bad in ["a", "space", "<Control>", "<Hyper>a", "<Control>ab", "<Control>A", "<Control><Alt>s; rm -rf ~", "F13"] {
            assert!(!is_valid_accelerator(bad), "{bad}");
        }
    }

    #[test]
    fn parses_and_formats_gvariant_lists() {
        assert_eq!(parse_list("@as []"), Vec::<String>::new());
        let list = parse_list("['/a/custom0/', '/a/burrow-launcher/']");
        assert_eq!(list, vec!["/a/custom0/", "/a/burrow-launcher/"]);
        assert_eq!(format_list(&list), "['/a/custom0/', '/a/burrow-launcher/']");
        assert_eq!(format_list(&[]), "[]");
    }

    #[test]
    fn ignores_the_deleted_suffix_after_an_upgrade() {
        assert_eq!(without_deleted_suffix("/usr/bin/burrow (deleted)"), "/usr/bin/burrow");
        assert_eq!(without_deleted_suffix("/usr/bin/burrow"), "/usr/bin/burrow");
    }

    #[test]
    fn quotes_paths_for_glib() {
        assert_eq!(shell_quote("/usr/bin/burrow"), "/usr/bin/burrow");
        assert_eq!(shell_quote("/home/me/My Apps/burrow"), "'/home/me/My Apps/burrow'");
        assert_eq!(shell_quote("it's"), r"'it'\''s'");
    }
}
