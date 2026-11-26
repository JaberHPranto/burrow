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

/// How the window behaves (Settings → General, or the pin button).
/// Mirrored by `WindowMode` in `src/core/platform/commands.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowMode {
    /// Spotlight-style: hides when it loses focus.
    #[default]
    Launcher,
    /// Stays open and above other windows.
    Pinned,
    /// Stays open like a regular window; shows in the taskbar and Alt+Tab.
    Normal,
}

#[derive(Default)]
pub struct WindowModeState(pub Mutex<WindowMode>);

pub fn window_mode(app: &AppHandle) -> WindowMode {
    app.state::<WindowModeState>().0.lock().map(|m| *m).unwrap_or_default()
}

/// Apply a mode to the window. Returns whether "on top" is in effect
/// (false on Wayland without the GNOME extension; see `shell_helper`).
pub async fn apply_mode(app: &AppHandle, mode: WindowMode) -> bool {
    if let Ok(mut current) = app.state::<WindowModeState>().0.lock() {
        *current = mode;
    }
    if let Some(w) = main_window(app) {
        // Works on X11; GNOME on Wayland ignores it, hence the Shell helper below.
        let _ = w.set_always_on_top(mode != WindowMode::Normal);
        let _ = w.set_skip_taskbar(mode != WindowMode::Normal);
    }
    if !crate::shell_helper::is_wayland() {
        return true;
    }
    let pinned = mode == WindowMode::Pinned;
    // Visible window: pin/unpin it now. Hidden: `show` re-pins when it appears.
    crate::shell_helper::set_above(pinned).await;
    !pinned || crate::shell_helper::available().await
}

/// A hidden Wayland window is destroyed and recreated on show, so the Shell
/// forgets "above". Re-apply it once the window is mapped.
fn repin_after_show(app: &AppHandle) {
    if window_mode(app) != WindowMode::Pinned || !crate::shell_helper::is_wayland() {
        return;
    }
    tauri::async_runtime::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        crate::shell_helper::set_above(true).await;
    });
}

/// Wayland apps can't position their own window (`center()` is ignored), so ask
/// the Shell helper to do it. The window isn't mapped the instant `show` returns,
/// so retry briefly. Without the extension this quietly does nothing.
fn center_after_show() {
    if !crate::shell_helper::is_wayland() {
        return;
    }
    tauri::async_runtime::spawn(async {
        for _ in 0..12 {
            tokio::time::sleep(std::time::Duration::from_millis(25)).await;
            if crate::shell_helper::center().await {
                return;
            }
        }
    });
}

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
        center_after_show();
        repin_after_show(app);
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

/// Hide when the window loses focus, like a launcher should (Launcher mode only).
/// Debug builds skip this so devtools stay usable.
pub fn install_blur_to_hide(app: &AppHandle) {
    if cfg!(debug_assertions) {
        return;
    }
    if let Some(w) = main_window(app) {
        let handle = app.clone();
        w.on_window_event(move |event| {
            let suppressed = handle.state::<BlurGuard>().0.load(Ordering::SeqCst)
                || window_mode(&handle) != WindowMode::Launcher;
            if let WindowEvent::Focused(false) = event {
                if !suppressed {
                    hide(&handle);
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::WindowMode;

    #[test]
    fn window_mode_accepts_only_known_values() {
        let parse = |s: &str| serde_json::from_str::<WindowMode>(s).ok();
        assert_eq!(parse(r#""pinned""#), Some(WindowMode::Pinned));
        assert_eq!(parse(r#""launcher""#), Some(WindowMode::Launcher));
        assert_eq!(parse(r#""normal""#), Some(WindowMode::Normal));
        assert_eq!(parse(r#""fullscreen""#), None);
    }
}
