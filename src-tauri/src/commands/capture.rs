//! Screen capture and colour picking through `xdg-desktop-portal`.
//!
//! On Wayland apps can't read the screen directly; the portal shows GNOME's own
//! UI (area/window/screen picker, or the colour-picker crosshair) and hands back
//! the result. Burrow's window is hidden while that happens so it isn't captured.

use std::time::Duration;

use ashpd::desktop::{screenshot::Screenshot, Color};
use serde::Serialize;
use tauri::{ipc::Response, AppHandle};

use crate::{
    error::{Error, Result},
    window,
};

/// Give the compositor a moment to remove our window before the portal grabs the screen.
const HIDE_DELAY: Duration = Duration::from_millis(250);

fn portal_error(err: ashpd::Error) -> Error {
    match err {
        ashpd::Error::Response(ashpd::desktop::ResponseError::Cancelled) => Error::Message("cancelled".into()),
        other => Error::Message(format!("Screen portal error: {other}. Is xdg-desktop-portal-gnome installed?")),
    }
}

/// Run `f` with the launcher hidden, then bring it back no matter what happened.
async fn while_hidden<T, F, Fut>(app: &AppHandle, f: F) -> Result<T>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let _guard = window::SuppressBlur::new(app);
    window::hide(app);
    tokio::time::sleep(HIDE_DELAY).await;
    let result = f().await;
    window::show(app);
    result
}

/// Capture the screen. `interactive` lets the user choose an area or window.
/// Returns the PNG bytes as a raw binary response (no JSON/base64 overhead).
#[tauri::command]
pub async fn capture_screenshot(app: AppHandle, interactive: bool) -> Result<Response> {
    while_hidden(&app, || async {
        let shot = Screenshot::request()
            .interactive(interactive)
            .modal(true)
            .send()
            .await
            .and_then(|req| req.response())
            .map_err(portal_error)?;
        let path = shot
            .uri()
            .to_file_path()
            .map_err(|_| Error::Message("Portal returned a non-file URI".into()))?;
        let bytes = tokio::fs::read(&path).await?;
        Ok(Response::new(bytes))
    })
    .await
}

#[derive(Serialize)]
pub struct Rgb {
    r: u8,
    g: u8,
    b: u8,
}

/// Let the user click any pixel on screen and return its colour.
#[tauri::command]
pub async fn pick_color(app: AppHandle) -> Result<Rgb> {
    while_hidden(&app, || async {
        let color = Color::pick()
            .send()
            .await
            .and_then(|req| req.response())
            .map_err(portal_error)?;
        let to_u8 = |v: f64| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
        Ok(Rgb { r: to_u8(color.red()), g: to_u8(color.green()), b: to_u8(color.blue()) })
    })
    .await
}
