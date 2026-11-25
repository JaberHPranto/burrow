//! OCR via the system `tesseract` binary (local, offline).
//! Install: `sudo apt install tesseract-ocr` (+ `tesseract-ocr-ben` for Bangla).

use std::{
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};

use crate::error::{Error, Result};

/// Upper bound for an image sent from the webview (raw bytes).
const MAX_IMAGE_BYTES: usize = 40 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrStatus {
    available: bool,
    languages: Vec<String>,
}

fn list_languages() -> Option<Vec<String>> {
    let out = Command::new("tesseract").arg("--list-langs").output().ok()?;
    if !out.status.success() {
        return None;
    }
    // tesseract prints the header to stderr on some versions and stdout on others.
    let text = String::from_utf8_lossy(&out.stdout);
    Some(parse_languages(&text))
}

fn parse_languages(text: &str) -> Vec<String> {
    let mut langs: Vec<String> = text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with("List of") && *l != "osd")
        .map(String::from)
        .collect();
    langs.sort();
    langs
}

/// `eng`, `ben`, `eng+ben` … each part must be an installed language.
fn valid_lang(lang: &str, installed: &[String]) -> bool {
    !lang.is_empty()
        && lang.len() <= 64
        && lang
            .split('+')
            .all(|part| part.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') && installed.iter().any(|i| i == part))
}

#[tauri::command]
pub async fn ocr_status() -> OcrStatus {
    tauri::async_runtime::spawn_blocking(|| match list_languages() {
        Some(languages) => OcrStatus { available: true, languages },
        None => OcrStatus { available: false, languages: vec![] },
    })
    .await
    .unwrap_or(OcrStatus { available: false, languages: vec![] })
}

/// Body: raw image bytes (PNG/JPEG). Header `x-ocr-lang`: e.g. "eng" or "eng+ben".
#[tauri::command]
pub async fn ocr_image(request: Request<'_>) -> Result<String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(Error::Message("Expected raw image bytes".into()));
    };
    if bytes.is_empty() || bytes.len() > MAX_IMAGE_BYTES {
        return Err(Error::Message("Image is empty or too large".into()));
    }
    let lang = request
        .headers()
        .get("x-ocr-lang")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("eng")
        .to_owned();
    let bytes = bytes.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let installed = list_languages().ok_or_else(|| Error::Message("tesseract is not installed".into()))?;
        if !valid_lang(&lang, &installed) {
            return Err(Error::Message(format!("Language \"{lang}\" is not installed")));
        }
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
        let path = std::env::temp_dir().join(format!("burrow-ocr-{}-{nanos}.img", std::process::id()));
        std::fs::write(&path, &bytes)?;
        let output = Command::new("tesseract").arg(&path).arg("stdout").args(["-l", &lang, "--psm", "3"]).output();
        let _ = std::fs::remove_file(&path);
        let output = output?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(Error::Message(format!("tesseract failed: {}", err.lines().last().unwrap_or("unknown error"))));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    })
    .await
    .map_err(|e| Error::Message(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_language_list() {
        let out = "List of available languages in \"/usr/share/tesseract-ocr/5/tessdata/\" (3):\nben\neng\nosd\n";
        assert_eq!(parse_languages(out), vec!["ben", "eng"]);
    }

    #[test]
    fn validates_languages() {
        let installed = vec!["eng".to_string(), "ben".to_string()];
        assert!(valid_lang("eng", &installed));
        assert!(valid_lang("eng+ben", &installed));
        assert!(!valid_lang("fra", &installed));
        assert!(!valid_lang("eng;rm -rf", &installed));
        assert!(!valid_lang("", &installed));
    }
}
