use tauri::{AppHandle, State};

use crate::window::{self, OpenToolRequest, PendingTool};

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
