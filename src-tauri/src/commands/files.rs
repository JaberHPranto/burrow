//! Saving files. The save dialog is opened from Rust, so the webview can only
//! write to a path the user just chose — it never passes a path itself.

use std::path::PathBuf;

use tauri::{
    ipc::{InvokeBody, Request},
    AppHandle, Manager,
};
use tauri_plugin_dialog::DialogExt;

use crate::error::{Error, Result};

/// Body: raw PNG bytes. Header `x-file-name`: suggested file name.
/// Returns the saved path, or `None` if the user cancelled.
#[tauri::command]
pub async fn save_png(app: AppHandle, request: Request<'_>) -> Result<Option<String>> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(Error::Message("Expected raw PNG bytes".into()));
    };
    let bytes = bytes.clone();
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(sanitize_file_name)
        .unwrap_or_else(|| "burrow.png".into());

    let default_dir = app
        .path()
        .picture_dir()
        .map(|p| p.join("Screenshots"))
        .ok()
        .filter(|p| p.is_dir())
        .or_else(|| app.path().picture_dir().ok());

    let _guard = crate::window::SuppressBlur::new(&app);
    let dialog_app = app.clone();
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        let app = dialog_app;
        let mut dialog = app.dialog().file().set_file_name(&name).add_filter("PNG image", &["png"]);
        if let Some(dir) = default_dir {
            dialog = dialog.set_directory(dir);
        }
        dialog.blocking_save_file()
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?;

    let Some(path) = chosen.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let path = with_png_extension(path);
    tokio::fs::write(&path, bytes).await?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Body: raw UTF-8 JSON. Header `x-file-name`. Used for backups (Settings → Data).
#[tauri::command]
pub async fn save_json(app: AppHandle, request: Request<'_>) -> Result<Option<String>> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(Error::Message("Expected raw JSON bytes".into()));
    };
    if serde_json::from_slice::<serde_json::Value>(bytes).is_err() {
        return Err(Error::Message("Not valid JSON".into()));
    }
    let bytes = bytes.clone();
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(sanitize_file_name)
        .unwrap_or_else(|| "burrow-backup.json".into());
    let _guard = crate::window::SuppressBlur::new(&app);
    let dialog_app = app.clone();
    let chosen = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = dialog_app.dialog().file().set_file_name(&name).add_filter("JSON", &["json"]);
        if let Ok(dir) = dialog_app.path().document_dir() {
            dialog = dialog.set_directory(dir);
        }
        dialog.blocking_save_file()
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?;
    let Some(path) = chosen.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let path = if path.extension().is_some_and(|e| e.eq_ignore_ascii_case("json")) {
        path
    } else {
        path.with_extension("json")
    };
    tokio::fs::write(&path, bytes).await?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | '\0'))
        .take(120)
        .collect();
    if cleaned.trim().is_empty() || cleaned.starts_with('.') {
        "burrow.png".into()
    } else {
        cleaned
    }
}

fn with_png_extension(path: PathBuf) -> PathBuf {
    match path.extension() {
        Some(ext) if ext.eq_ignore_ascii_case("png") => path,
        _ => path.with_extension("png"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize_file_name("shot 1.png"), "shot 1.png");
        assert_eq!(sanitize_file_name("../../etc/passwd"), "burrow.png");
        assert_eq!(sanitize_file_name("a/b.png"), "ab.png");
        assert_eq!(sanitize_file_name(".hidden"), "burrow.png");
        assert_eq!(sanitize_file_name(""), "burrow.png");
    }

    #[test]
    fn forces_png_extension() {
        assert_eq!(with_png_extension(PathBuf::from("/a/b")), PathBuf::from("/a/b.png"));
        assert_eq!(with_png_extension(PathBuf::from("/a/b.PNG")), PathBuf::from("/a/b.PNG"));
    }
}
