
use tauri::{AppHandle, Manager, State};

use crate::{
    error::{Error, Result},
    window::{self, OpenToolRequest, PendingTool, WindowMode},
};

/// Hide the launcher (Esc on the home screen).
#[tauri::command]
pub fn hide_launcher(app: AppHandle) {
    window::hide(&app);
}

/// Returns (and clears) a tool requested via `burrow --tool <id>` at startup.
#[tauri::command]
pub fn take_pending_tool(pending: State<'_, PendingTool>) -> Option<OpenToolRequest> {
    pending.0.lock().ok().and_then(|mut p| p.take())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowModeResult {
    /// False when Pinned can't keep the window on top (Wayland without the extension).
    keep_above: bool,
}

/// Settings → General / pin button: launcher, pinned or normal window.
/// The mode is an enum, so serde rejects anything else from the webview.
#[tauri::command]
pub async fn set_window_mode(app: AppHandle, mode: WindowMode) -> WindowModeResult {
    WindowModeResult { keep_above: window::apply_mode(&app, mode).await }
}

/// Folder holding `burrow.json` (settings + tool data), shown in Settings → Data.
#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> Result<String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| Error::Message(e.to_string()))
}
