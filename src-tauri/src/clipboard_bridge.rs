//! D-Bus service that receives clipboard text from the companion GNOME Shell
//! extension (`extension/`) and forwards it to the frontend as an event.
//!
//! Bus name `dev.burrow.Clipboard`, object `/dev/burrow/Clipboard`:
//!   Push(s text)   — a new clipboard entry
//!   Ping() → s     — health check, returns Burrow's version
//!
//! Only processes of the same user can reach the session bus.

use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter, Manager};

pub const BUS_NAME: &str = "dev.burrow.Clipboard";
const OBJECT_PATH: &str = "/dev/burrow/Clipboard";
/// Frontend event name — mirrored in `src/core/platform/events.ts`.
pub const EVENT_CLIPBOARD: &str = "burrow://clipboard";
const MAX_LENGTH: usize = 200_000;

/// When the extension last talked to us (unix seconds, 0 = never this session).
#[derive(Default)]
pub struct BridgeState {
    pub last_seen: AtomicU64,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

struct Bridge {
    app: AppHandle,
    state: Arc<BridgeState>,
}

#[zbus::interface(name = "dev.burrow.Clipboard")]
impl Bridge {
    fn push(&self, text: String) {
        self.state.last_seen.store(now(), Ordering::Relaxed);
        if !text.trim().is_empty() && text.len() <= MAX_LENGTH {
            let _ = self.app.emit(EVENT_CLIPBOARD, text);
        }
    }

    fn ping(&self) -> String {
        self.state.last_seen.store(now(), Ordering::Relaxed);
        env!("CARGO_PKG_VERSION").to_owned()
    }
}

/// Start the service in the background. Failure (no session bus) is logged and
/// ignored — clipboard history then falls back to recording on launcher open.
pub fn start(app: &AppHandle) {
    let state = Arc::new(BridgeState::default());
    app.manage(state.clone());
    let bridge = Bridge { app: app.clone(), state };
    tauri::async_runtime::spawn(async move {
        let conn = zbus::connection::Builder::session()
            .and_then(|b| b.name(BUS_NAME))
            .and_then(|b| b.serve_at(OBJECT_PATH, bridge));
        match conn {
            Ok(builder) => match builder.build().await {
                // Keep the connection alive for the app's lifetime.
                Ok(_connection) => std::future::pending::<()>().await,
                Err(e) => eprintln!("burrow: clipboard bridge unavailable: {e}"),
            },
            Err(e) => eprintln!("burrow: clipboard bridge unavailable: {e}"),
        }
    });
}
