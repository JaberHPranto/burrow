//! Which optional system packages are installed? Drives the "missing package"
//! badges in the launcher. The catalogue of what each package is for lives in
//! the frontend (`src/core/deps/catalog.ts`); this only answers yes/no.

use std::{path::Path, process::Command};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    /// Matches an id in `src/core/deps/catalog.ts`.
    id: &'static str,
    installed: bool,
}

/// Is `program` an executable file somewhere on PATH?
pub fn on_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(program).is_file()))
        .unwrap_or(false)
}

/// GNOME's portal backend lives in libexec, not on PATH.
fn portal_backend_installed() -> bool {
    ["/usr/libexec/xdg-desktop-portal-gnome", "/usr/lib/xdg-desktop-portal-gnome"]
        .iter()
        .any(|p| Path::new(p).is_file())
}

fn tesseract_has_language(lang: &str) -> bool {
    Command::new("tesseract")
        .arg("--list-langs")
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).lines().any(|l| l.trim() == lang))
        .unwrap_or(false)
}

#[tauri::command]
pub async fn check_dependencies() -> Vec<DependencyStatus> {
    tauri::async_runtime::spawn_blocking(|| {
        let tesseract = on_path("tesseract");
        vec![
            DependencyStatus { id: "gnome-screenshot", installed: on_path("gnome-screenshot") },
            DependencyStatus { id: "portal", installed: portal_backend_installed() },
            DependencyStatus { id: "tesseract", installed: tesseract },
            DependencyStatus { id: "tesseract-ben", installed: tesseract && tesseract_has_language("ben") },
        ]
    })
    .await
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_programs_on_path() {
        assert!(on_path("sh"));
        assert!(!on_path("definitely-not-a-real-program-burrow"));
    }
}
