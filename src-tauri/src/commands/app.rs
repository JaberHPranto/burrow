use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, State};

use crate::{
    error::{Error, Result},
    window::{self, HideOnBlur, OpenToolRequest, PendingTool},
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

/// Settings → General: hide the launcher when it loses focus (release builds).
#[tauri::command]
pub fn set_hide_on_blur(enabled: bool, pref: State<'_, HideOnBlur>) {
    pref.0.store(enabled, Ordering::SeqCst);
}

/// Folder holding `burrow.json` (settings + tool data), shown in Settings → Data.
#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> Result<String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| Error::Message(e.to_string()))
}
