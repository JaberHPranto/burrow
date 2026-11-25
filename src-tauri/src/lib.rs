//! Burrow — Tauri entry point.
//!
//! Layout:
//! - `cli`      — parses `burrow --toggle` / `burrow --tool <id>` (used by GNOME hotkeys)
//! - `window`   — show / hide / toggle the launcher window, emit navigation events
//! - `tray`     — system tray icon + menu
//! - `commands` — `#[tauri::command]` handlers, one module per tool that needs Rust

mod cli;
mod commands;
mod error;
mod tray;
mod window;

use tauri::Manager;

use crate::cli::Action;

pub fn run() {
    tauri::Builder::default()
        // Must be registered first: a second `burrow ...` invocation forwards its args here
        // and exits, which is how desktop-wide hotkeys reach the running instance.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            window::handle_action(app, cli::parse(&argv));
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(window::PendingTool::default())
        .invoke_handler(tauri::generate_handler![
            commands::ports::list_listening_ports,
            commands::ports::kill_process,
            commands::app::hide_launcher,
            commands::app::take_pending_tool,
        ])
        .setup(|app| {
            tray::create(app.handle())?;
            window::install_blur_to_hide(app.handle());

            match cli::parse(&std::env::args().collect::<Vec<_>>()) {
                Action::Background => {}
                Action::Toggle => window::show(app.handle()),
                Action::OpenTool(id) => window::open_tool_on_startup(app.handle(), &id),
            }
            // Keep a handle around so the window is never dropped.
            let _ = app.get_webview_window(window::MAIN);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Burrow");
}
