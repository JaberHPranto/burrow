//! Launcher window behaviour: Spotlight-style show/hide.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WindowEvent};

use crate::cli::Action;

pub const MAIN: &str = "main";

/// Frontend event names — mirrored in `src/core/platform/events.ts`.
pub const EVENT_OPEN_TOOL: &str = "burrow://open-tool";
pub const EVENT_SHOWN: &str = "burrow://shown";

/// A tool requested before the frontend was listening (cold start with `--tool`).
/// The frontend collects it once via the `take_pending_tool` command.
#[derive(Default)]
pub struct PendingTool(pub Mutex<Option<String>>);

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

pub fn show(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.center();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = app.emit(EVENT_SHOWN, ());
    }
}

pub fn hide(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.hide();
    }
}

pub fn toggle(app: &AppHandle) {
    match main_window(app).and_then(|w| w.is_visible().ok()) {
        Some(true) => hide(app),
        _ => show(app),
    }
}

pub fn open_tool(app: &AppHandle, id: &str) {
    show(app);
    let _ = app.emit(EVENT_OPEN_TOOL, id.to_owned());
}

/// Cold start: remember the tool instead of emitting an event nobody hears yet.
pub fn open_tool_on_startup(app: &AppHandle, id: &str) {
    if let Ok(mut pending) = app.state::<PendingTool>().0.lock() {
        *pending = Some(id.to_owned());
    }
    show(app);
}

pub fn handle_action(app: &AppHandle, action: Action) {
    match action {
        Action::Background => show(app),
        Action::Toggle => toggle(app),
        Action::OpenTool(id) => open_tool(app, &id),
    }
}

/// Hide when the window loses focus, like a launcher should.
/// Debug builds skip this so devtools stay usable.
pub fn install_blur_to_hide(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    if let Some(w) = main_window(app) {
        let handle = app.clone();
        w.on_window_event(move |event| {
            if let WindowEvent::Focused(false) = event {
                hide(&handle);
            }
        });
    }
}
