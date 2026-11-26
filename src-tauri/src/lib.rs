//! Burrow — Tauri entry point.
//!
//! Layout:
//! - `cli`      — parses `burrow --toggle` / `burrow --tool <id>` (used by GNOME hotkeys)
//! - `window`   — show / hide / toggle the launcher window, emit navigation events
//! - `tray`     — system tray icon + menu
//! - `commands` — `#[tauri::command]` handlers, one module per native capability

mod cli;
mod clipboard_bridge;
mod commands;
mod error;
mod shell_helper;
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
        .plugin(tauri_plugin_dialog::init())
        // Start on login (Settings → General). No args → starts quietly in the tray.
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .manage(window::PendingTool::default())
        .manage(window::BlurGuard::default())
        .manage(window::WindowModeState::default())
        .manage(std::sync::Arc::new(commands::ai_stream::AiTasks::default()))
        .invoke_handler(tauri::generate_handler![
            commands::ports::list_listening_ports,
            commands::ports::kill_process,
            commands::app::hide_launcher,
            commands::app::take_pending_tool,
            commands::capture::capture_screenshot,
            commands::capture::pick_color,
            commands::deps::check_dependencies,
            commands::ocr::ocr_status,
            commands::ocr::ocr_image,
            commands::files::save_png,
            commands::files::save_json,
            commands::app::set_window_mode,
            commands::app::app_data_dir,
            commands::hotkeys::get_hotkeys,
            commands::hotkeys::set_hotkey,
            commands::ai::ai_key_status,
            commands::ai::ai_set_key,
            commands::ai::ai_delete_key,
            commands::ai::ai_test,
            commands::ai_stream::ai_stream,
            commands::ai_stream::ai_cancel,
            tray::set_tray_items,
            commands::clipboard::clipboard_bridge_status,
            commands::clipboard::install_clipboard_extension,
            commands::clipboard::uninstall_clipboard_extension,
        ])
        .setup(|app| {
            tray::create(app.handle())?;
            clipboard_bridge::start(app.handle());
            window::install_blur_to_hide(app.handle());

            match cli::parse(&std::env::args().collect::<Vec<_>>()) {
                Action::Background => {}
                Action::Toggle => window::show(app.handle()),
                Action::OpenTool { id, run } => window::open_tool_on_startup(app.handle(), &id, run),
            }
            // Keep a handle around so the window is never dropped.
            let _ = app.get_webview_window(window::MAIN);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Burrow");
}
