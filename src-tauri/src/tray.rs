//! System tray. On GNOME the tray only shows a menu (clicks on the icon itself
//! are not delivered), so every action lives in the menu.
//!
//! The quick tools in the middle of the menu are chosen in Settings → Tray: the
//! webview sends the list (`set_tray_items`) and the menu is rebuilt. Until it
//! does (right after start-up), `DEFAULT_ITEMS` is shown.
//!
//! Menu item ids encode the action, so no state is needed to handle a click:
//! `open:<tool>` opens a tool, `run:<tool>` opens it and starts its main action.

use serde::Deserialize;
use tauri::{
    image::Image,
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Wry,
};

use crate::{
    cli::is_valid_tool_id,
    error::{Error, Result},
    window,
};

const TRAY_ID: &str = "burrow";
const MAX_ITEMS: usize = 20;
const MAX_LABEL: usize = 60;

/// One quick tool in the menu. Mirrors `TrayItem` in `src/core/platform/commands.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct TrayItem {
    pub id: String,
    pub label: String,
    /// Start the tool's main action (capture, pick, run on the clipboard).
    #[serde(default)]
    pub run: bool,
}

/// Shown until Settings sends the user's choice. Same as the app's default.
fn default_items() -> Vec<TrayItem> {
    [
        ("screenshot", "Take screenshot", true),
        ("ocr", "Grab text (OCR)", true),
        ("color-picker", "Pick colour", true),
        ("tasks", "Tasks", false),
        ("quick-notes", "Quick notes", false),
        ("clipboard-history", "Clipboard history", false),
        ("emoji-picker", "Emoji picker", false),
    ]
    .into_iter()
    .map(|(id, label, run)| TrayItem { id: id.into(), label: label.into(), run })
    .collect()
}

/// Reject anything odd from the webview: unknown-looking ids, empty or huge labels.
fn validate(items: &[TrayItem]) -> Result<()> {
    if items.len() > MAX_ITEMS {
        return Err(Error::Message(format!("The tray can show at most {MAX_ITEMS} tools")));
    }
    for item in items {
        let label = item.label.trim();
        if !is_valid_tool_id(&item.id)
            || label.is_empty()
            || label.chars().count() > MAX_LABEL
            || label.chars().any(char::is_control)
        {
            return Err(Error::Message(format!("Invalid tray item \"{}\"", item.id)));
        }
    }
    Ok(())
}

fn menu_id(item: &TrayItem) -> String {
    format!("{}:{}", if item.run { "run" } else { "open" }, item.id)
}

/// `open:tasks` → ("tasks", false); `run:ocr` → ("ocr", true).
fn parse_menu_id(id: &str) -> Option<(&str, bool)> {
    let (kind, tool) = id.split_once(':')?;
    let run = match kind {
        "open" => false,
        "run" => true,
        _ => return None,
    };
    is_valid_tool_id(tool).then_some((tool, run))
}

fn build_menu(app: &AppHandle, items: &[TrayItem]) -> tauri::Result<Menu<Wry>> {
    let open = MenuItem::with_id(app, "app:open", "Open Burrow", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "open:settings", "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "app:quit", "Quit", true, None::<&str>)?;
    let separators = [
        PredefinedMenuItem::separator(app)?,
        PredefinedMenuItem::separator(app)?,
    ];
    let tools = items
        .iter()
        .map(|i| MenuItem::with_id(app, menu_id(i), i.label.trim(), true, None::<&str>))
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut entries: Vec<&dyn IsMenuItem<Wry>> = vec![&open];
    if !tools.is_empty() {
        entries.push(&separators[0]);
        entries.extend(tools.iter().map(|t| t as &dyn IsMenuItem<Wry>));
    }
    entries.push(&separators[1]);
    entries.push(&settings);
    entries.push(&quit);
    Menu::with_items(app, &entries)
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, &default_items())?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .tooltip("Burrow")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "app:open" => window::show(app),
            "app:quit" => app.exit(0),
            id => {
                if let Some((tool, run)) = parse_menu_id(id) {
                    window::open_tool(app, tool, run);
                }
            }
        })
        .build(app)?;
    Ok(())
}

/// Settings → Tray: replace the quick tools in the menu.
#[tauri::command]
pub fn set_tray_items(app: AppHandle, items: Vec<TrayItem>) -> Result<()> {
    validate(&items)?;
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| Error::Message("The tray isn't available".into()))?;
    let menu = build_menu(&app, &items).map_err(|e| Error::Message(e.to_string()))?;
    tray.set_menu(Some(menu)).map_err(|e| Error::Message(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, label: &str, run: bool) -> TrayItem {
        TrayItem { id: id.into(), label: label.into(), run }
    }

    #[test]
    fn round_trips_menu_ids() {
        for i in default_items() {
            assert_eq!(parse_menu_id(&menu_id(&i)), Some((i.id.as_str(), i.run)));
        }
        assert_eq!(parse_menu_id("open:settings"), Some(("settings", false)));
    }

    #[test]
    fn ignores_unknown_menu_ids() {
        assert_eq!(parse_menu_id("app:quit"), None);
        assert_eq!(parse_menu_id("run:../etc"), None);
        assert_eq!(parse_menu_id("tasks"), None);
    }

    #[test]
    fn validates_items_from_the_webview() {
        assert!(validate(&default_items()).is_ok());
        assert!(validate(&[item("Bad Id", "x", false)]).is_err());
        assert!(validate(&[item("tasks", "  ", false)]).is_err());
        assert!(validate(&[item("tasks", &"x".repeat(61), false)]).is_err());
        assert!(validate(&[item("tasks", "Tasks\n", false)]).is_ok()); // trimmed
        assert!(validate(&[item("tasks", "Ta\u{7}sks", false)]).is_err());
        let many: Vec<_> = (0..21).map(|i| item(&format!("t{i}"), "x", false)).collect();
        assert!(validate(&many).is_err());
        assert!(validate(&[]).is_ok());
    }
}
