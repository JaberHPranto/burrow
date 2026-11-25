//! Client for the window half of the Burrow GNOME Shell extension (`src-tauri/extension`).
//!
//! On Wayland an app can't keep its own window above others; GNOME ignores the
//! request. The extension runs inside GNOME Shell, which can, so it exports a
//! tiny D-Bus object on the Shell's own connection:
//!   bus `org.gnome.Shell`, path `/dev/burrow/Shell`, interface `dev.burrow.Shell`
//!   Ping() -> u (helper version), SetAbove(u pid, b above) -> b (window found)
//! Every call is best-effort with a short timeout: no extension = `false`.

use std::time::Duration;

const BUS: &str = "org.gnome.Shell";
const PATH: &str = "/dev/burrow/Shell";
const IFACE: &str = "dev.burrow.Shell";
const TIMEOUT: Duration = Duration::from_millis(800);

/// True when Burrow is a native Wayland client (the default under GNOME Wayland).
/// Under X11 (or XWayland via `GDK_BACKEND=x11`) Tauri's always-on-top works by itself.
pub fn is_wayland() -> bool {
    let forced_x11 = std::env::var("GDK_BACKEND").is_ok_and(|b| b.starts_with("x11"));
    !forced_x11 && std::env::var_os("WAYLAND_DISPLAY").is_some()
}

async fn call<B, R>(method: &str, body: &B) -> Option<R>
where
    B: serde::Serialize + zbus::zvariant::DynamicType,
    R: for<'de> serde::Deserialize<'de> + zbus::zvariant::Type,
{
    let request = async {
        let conn = zbus::Connection::session().await.ok()?;
        let reply = conn.call_method(Some(BUS), PATH, Some(IFACE), method, body).await.ok()?;
        reply.body().deserialize::<R>().ok()
    };
    tokio::time::timeout(TIMEOUT, request).await.ok().flatten()
}

/// Is the extension loaded in the running Shell (with the window helper)?
pub async fn available() -> bool {
    call::<_, u32>("Ping", &()).await.is_some()
}

/// Ask GNOME Shell to keep Burrow's window above others (or stop).
/// Returns false if the extension isn't running or the window isn't mapped.
pub async fn set_above(above: bool) -> bool {
    call::<_, bool>("SetAbove", &(std::process::id(), above)).await.unwrap_or(false)
}
