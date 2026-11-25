//! Install / inspect the companion GNOME Shell extension for clipboard history.

use std::{
    path::PathBuf,
    process::Command,
    sync::{atomic::Ordering, Arc},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::State;

use crate::{
    clipboard_bridge::BridgeState,
    error::{Error, Result},
};

const UUID: &str = "burrow-clipboard@burrow.dev";
const LEGACY_JS: &str = include_str!("../../extension/legacy/extension.js");
const LEGACY_META: &str = include_str!("../../extension/legacy/metadata.json");
const ESM_JS: &str = include_str!("../../extension/esm/extension.js");
const ESM_META: &str = include_str!("../../extension/esm/metadata.json");

fn extension_dir() -> Result<PathBuf> {
    let home = std::env::var_os("HOME").ok_or_else(|| Error::Message("HOME is not set".into()))?;
    Ok(PathBuf::from(home).join(".local/share/gnome-shell/extensions").join(UUID))
}

/// Major GNOME Shell version, e.g. 42, from `gnome-shell --version`.
fn shell_major() -> Option<u32> {
    let out = Command::new("gnome-shell").arg("--version").output().ok()?;
    parse_shell_major(&String::from_utf8_lossy(&out.stdout))
}

fn parse_shell_major(text: &str) -> Option<u32> {
    text.split_whitespace().last()?.split('.').next()?.parse().ok()
}

fn gsettings(args: &[&str]) -> Result<String> {
    let out = Command::new("gsettings").args(args).output()?;
    if !out.status.success() {
        return Err(Error::Message(String::from_utf8_lossy(&out.stderr).trim().to_owned()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_owned())
}

fn enabled_extensions() -> Vec<String> {
    gsettings(&["get", "org.gnome.shell", "enabled-extensions"])
        .map(|t| t.split('\'').skip(1).step_by(2).map(String::from).collect())
        .unwrap_or_default()
}

fn set_enabled_extensions(list: &[String]) -> Result<()> {
    let quoted: Vec<String> = list.iter().map(|u| format!("'{u}'")).collect();
    gsettings(&["set", "org.gnome.shell", "enabled-extensions", &format!("[{}]", quoted.join(", "))])?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    installed: bool,
    /// Installed, but an older version than this Burrow ships (missing the window helper).
    outdated: bool,
    enabled: bool,
    /// Seconds since the extension last pushed/pinged, if it has this session.
    last_seen_secs_ago: Option<u64>,
    shell_version: Option<u32>,
}

#[tauri::command]
pub async fn clipboard_bridge_status(state: State<'_, Arc<BridgeState>>) -> Result<BridgeStatus> {
    let last = state.last_seen.load(Ordering::Relaxed);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let dir = extension_dir()?;
    let installed = dir.join("extension.js").is_file();
    let installed_version = std::fs::read_to_string(dir.join("metadata.json"))
        .ok()
        .and_then(|m| metadata_version(&m))
        .unwrap_or(0);
    let outdated = installed && installed_version < metadata_version(ESM_META).unwrap_or(0);
    let (enabled, shell_version) = tauri::async_runtime::spawn_blocking(|| {
        (enabled_extensions().iter().any(|u| u == UUID), shell_major())
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?;
    Ok(BridgeStatus {
        installed,
        outdated,
        enabled,
        last_seen_secs_ago: (last > 0).then(|| now.saturating_sub(last)),
        shell_version,
    })
}

/// The `version` field of an extension's metadata.json.
fn metadata_version(metadata: &str) -> Option<u64> {
    serde_json::from_str::<serde_json::Value>(metadata).ok()?.get("version")?.as_u64()
}

/// Write the extension for this GNOME version and mark it enabled (also updates it).
/// GNOME on Wayland only loads new extensions after logging out and in.
#[tauri::command]
pub async fn install_clipboard_extension() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        let major = shell_major().ok_or_else(|| Error::Message("GNOME Shell not found — this needs GNOME.".into()))?;
        let (js, meta) = if major >= 45 { (ESM_JS, ESM_META) } else { (LEGACY_JS, LEGACY_META) };
        let dir = extension_dir()?;
        std::fs::create_dir_all(&dir)?;
        std::fs::write(dir.join("extension.js"), js)?;
        std::fs::write(dir.join("metadata.json"), meta)?;

        let mut list = enabled_extensions();
        if !list.iter().any(|u| u == UUID) {
            list.push(UUID.to_owned());
            set_enabled_extensions(&list)?;
        }
        Ok("Installed. Log out and back in once so GNOME loads it.".to_owned())
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?
}

#[tauri::command]
pub async fn uninstall_clipboard_extension() -> Result<()> {
    tauri::async_runtime::spawn_blocking(|| {
        let list: Vec<String> = enabled_extensions().into_iter().filter(|u| u != UUID).collect();
        set_enabled_extensions(&list)?;
        let dir = extension_dir()?;
        if dir.is_dir() {
            std::fs::remove_dir_all(dir)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_shell_versions() {
        assert_eq!(parse_shell_major("GNOME Shell 42.9\n"), Some(42));
        assert_eq!(parse_shell_major("GNOME Shell 46.0"), Some(46));
        assert_eq!(parse_shell_major(""), None);
    }

    #[test]
    fn bundles_both_extension_variants() {
        assert!(LEGACY_JS.contains("imports.gi") && LEGACY_META.contains("\"42\""));
        assert!(ESM_JS.contains("export default class") && ESM_META.contains("\"45\""));
        for meta in [LEGACY_META, ESM_META] {
            let v: serde_json::Value = serde_json::from_str(meta).unwrap();
            assert_eq!(v["uuid"], UUID);
        }
        // Both variants must carry the same version so update detection works.
        assert_eq!(metadata_version(LEGACY_META), metadata_version(ESM_META));
        assert!(LEGACY_JS.contains("SetAbove") && ESM_JS.contains("SetAbove"));
    }

    #[test]
    fn reads_metadata_version() {
        assert_eq!(metadata_version(r#"{"uuid":"x","version":2}"#), Some(2));
        assert_eq!(metadata_version(r#"{"uuid":"x"}"#), None);
        assert_eq!(metadata_version("not json"), None);
    }
}
