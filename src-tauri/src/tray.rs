//! System tray. On GNOME the tray only shows a menu (clicks on the icon itself
//! are not delivered), so every action lives in the menu.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle,
};

use crate::window;

/// Tray quick actions: (menu id, label, tool id, run immediately).
/// Tool ids must exist in `src/tools`.
const QUICK_TOOLS: &[(&str, &str, &str, bool)] = &[
    ("tool:screenshot", "Take screenshot", "screenshot", true),
    ("tool:ocr", "Grab text (OCR)", "ocr", true),
    ("tool:color", "Pick colour", "color-picker", true),
    ("tool:tasks", "Tasks", "tasks", false),
    ("tool:notes", "Quick notes", "quick-notes", false),
    ("tool:clipboard", "Clipboard history", "clipboard-history", false),
    ("tool:settings", "Settings…", "settings", false),
];

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Burrow", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let quick = QUICK_TOOLS
        .iter()
        .map(|(id, label, _, _)| MenuItem::with_id(app, *id, *label, true, None::<&str>))
        .collect::<Result<Vec<_>, _>>()?;

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = vec![&open, &sep];
    items.extend(quick.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>));
    items.push(&sep2);
    items.push(&quit);
    let menu = Menu::with_items(app, &items)?;

    TrayIconBuilder::with_id("burrow")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .tooltip("Burrow")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => window::show(app),
            "quit" => app.exit(0),
            id => {
                if let Some((_, _, tool, run)) = QUICK_TOOLS.iter().find(|(menu_id, ..)| *menu_id == id) {
                    window::open_tool(app, tool, *run);
                }
            }
        })
        .build(app)?;
    Ok(())
}
