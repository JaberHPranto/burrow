//! Launcher window behaviour: Spotlight-style show/hide.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WindowEvent};

use crate::cli::Action;

pub const MAIN: &str = "main";

/// Frontend event names — mirrored in `src/core/platform/events.ts`.
pub const EVENT_OPEN_TOOL: &str = "burrow://open-tool";
pub const EVENT_SHOWN: &str = "burrow://shown";

/// Payload of `EVENT_OPEN_TOOL` and `take_pending_tool` — mirrored in `src/core/platform/events.ts`.
#[derive(Debug, Clone, serde::Serialize)]
pub struct OpenToolRequest {
    pub id: String,
    pub run: bool,
}

/// A tool requested before the frontend was listening (cold start with `--tool`).
/// The frontend collects it once via the `take_pending_tool` command.
#[derive(Default)]
pub struct PendingTool(pub Mutex<Option<OpenToolRequest>>);

/// While true, losing focus does not hide the window (portal pickers, save dialogs).
#[derive(Default)]
pub struct BlurGuard(AtomicBool);

/// Suppress hide-on-blur for the lifetime of the returned guard.
pub struct SuppressBlur(AppHandle);

impl SuppressBlur {
    pub fn new(app: &AppHandle) -> Self {
        app.state::<BlurGuard>().0.store(true, Ordering::SeqCst);
        Self(app.clone())
    }
}

impl Drop for SuppressBlur {
    fn drop(&mut self) {
        self.0.state::<BlurGuard>().0.store(false, Ordering::SeqCst);
    }
}

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

/// Open a tool. With `run`, the window stays hidden: the tool starts a capture
/// right away and the capture command shows the window when it's done.
pub fn open_tool(app: &AppHandle, id: &str, run: bool) {
    if !run {
        show(app);
    }
    let _ = app.emit(EVENT_OPEN_TOOL, OpenToolRequest { id: id.to_owned(), run });
}

/// Cold start: remember the tool instead of emitting an event nobody hears yet.
pub fn open_tool_on_startup(app: &AppHandle, id: &str, run: bool) {
    if let Ok(mut pending) = app.state::<PendingTool>().0.lock() {
        *pending = Some(OpenToolRequest { id: id.to_owned(), run });
    }
    if !run {
        show(app);
    }
}

pub fn handle_action(app: &AppHandle, action: Action) {
    match action {
        Action::Background => show(app),
        Action::Toggle => toggle(app),
        Action::OpenTool { id, run } => open_tool(app, &id, run),
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
            let suppressed = handle.state::<BlurGuard>().0.load(Ordering::SeqCst);
            if let WindowEvent::Focused(false) = event {
                if !suppressed {
                    hide(&handle);
                }
            }
        });
    }
}
