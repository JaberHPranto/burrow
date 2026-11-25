//! AI provider API keys (BYOK). Keys live in the system keyring (GNOME Keyring /
//! Secret Service) and never travel back to the webview: the UI can only ask
//! whether a key exists, set it, delete it, or test the connection. Requests to
//! providers are made from Rust, so keys never pass through the webview's CSP.

use std::{collections::HashMap, time::Duration};

use serde::Serialize;

use crate::error::{Error, Result};

const SERVICE: &str = "dev.burrow.app";
pub const PROVIDERS: &[&str] = &["openai", "anthropic", "openrouter", "ollama", "custom"];

fn check_provider(provider: &str) -> Result<()> {
    if PROVIDERS.contains(&provider) {
        Ok(())
    } else {
        Err(Error::Message(format!("Unknown provider \"{provider}\"")))
    }
}

/// The keyring's Secret Service backend blocks on its own async runtime, which
/// must not run inside Tauri's — so keyring calls happen on a plain thread.
fn off_runtime<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> Result<T> {
    std::thread::spawn(f).join().map_err(|_| Error::Message("Keyring thread panicked".into()))
}

fn entry(provider: &str) -> keyring::Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, &format!("ai:{provider}"))
}

pub(super) fn read_key(provider: &'static str) -> Result<Option<String>> {
    off_runtime(move || match entry(provider).and_then(|e| e.get_password()) {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(Error::Message(format!("Keyring: {e}"))),
    })?
}

pub(super) fn static_provider(provider: &str) -> Result<&'static str> {
    PROVIDERS
        .iter()
        .copied()
        .find(|p| *p == provider)
        .ok_or_else(|| Error::Message(format!("Unknown provider \"{provider}\"")))
}

/// Which providers have a stored key.
#[tauri::command]
pub async fn ai_key_status() -> Result<HashMap<String, bool>> {
    let mut out = HashMap::new();
    for p in PROVIDERS {
        out.insert((*p).to_owned(), read_key(p)?.is_some());
    }
    Ok(out)
}

#[tauri::command]
pub async fn ai_set_key(provider: String, key: String) -> Result<()> {
    check_provider(&provider)?;
    let key = key.trim().to_owned();
    if key.is_empty() || key.len() > 512 || key.chars().any(char::is_whitespace) {
        return Err(Error::Message("That doesn't look like an API key".into()));
    }
    off_runtime(move || entry(&provider).and_then(|e| e.set_password(&key)))?
        .map_err(|e| Error::Message(format!("Keyring: {e}")))
}

#[tauri::command]
pub async fn ai_delete_key(provider: String) -> Result<()> {
    check_provider(&provider)?;
    off_runtime(move || match entry(&provider).and_then(|e| e.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(Error::Message(format!("Keyring: {e}"))),
    })?
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Auth {
    Bearer,
    AnthropicKey,
    None,
}

fn valid_base_url(url: &str) -> bool {
    (url.starts_with("http://") || url.starts_with("https://"))
        && url.len() <= 300
        && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// The provider's API base URL: the user's override (validated) or the default.
/// OpenAI-style bases include the version path (`…/v1`); Anthropic and Ollama don't.
pub(super) fn provider_base(provider: &str, base_url: Option<&str>) -> Result<String> {
    let base = base_url.map(|b| b.trim().trim_end_matches('/')).filter(|b| !b.is_empty());
    if let Some(b) = base {
        if !valid_base_url(b) {
            return Err(Error::Message("Base URL must start with http:// or https://".into()));
        }
    }
    let default = match provider {
        "openai" => "https://api.openai.com/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        "anthropic" => "https://api.anthropic.com",
        "ollama" => "http://localhost:11434",
        "custom" => return base.map(String::from).ok_or_else(|| Error::Message("Set a base URL first".into())),
        other => return Err(Error::Message(format!("Unknown provider \"{other}\""))),
    };
    Ok(base.unwrap_or(default).to_owned())
}

pub(super) fn auth_for(provider: &str) -> Auth {
    match provider {
        "anthropic" => Auth::AnthropicKey,
        "ollama" => Auth::None,
        _ => Auth::Bearer,
    }
}

/// Where to list models for a provider, and how to authenticate.
fn models_endpoint(provider: &str, base_url: Option<&str>) -> Result<(String, Auth)> {
    let base = provider_base(provider, base_url)?;
    let path = match provider {
        "anthropic" => "/v1/models",
        "ollama" => "/api/tags",
        _ => "/models",
    };
    Ok((format!("{base}{path}"), auth_for(provider)))
}

/// Model ids from OpenAI/Anthropic (`data[].id`) or Ollama (`models[].name`).
fn parse_models(json: &serde_json::Value) -> Vec<String> {
    let from = |list: &str, field: &str| -> Vec<String> {
        json.get(list)
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|m| m.get(field)?.as_str().map(String::from)).collect())
            .unwrap_or_default()
    };
    let mut models = from("data", "id");
    models.extend(from("models", "name"));
    models.sort();
    models.dedup();
    models
}

#[derive(Serialize)]
pub struct TestResult {
    ok: bool,
    message: String,
    models: Vec<String>,
}

/// Call the provider's "list models" endpoint with the stored key.
#[tauri::command]
pub async fn ai_test(provider: String, base_url: Option<String>) -> Result<TestResult> {
    let provider = static_provider(&provider)?;
    let (url, auth) = models_endpoint(provider, base_url.as_deref())?;
    let key = read_key(provider)?;
    if auth != Auth::None && key.is_none() && provider != "custom" {
        return Ok(TestResult { ok: false, message: "No API key saved yet.".into(), models: vec![] });
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| Error::Message(e.to_string()))?;
    let mut req = client.get(&url);
    if let Some(k) = &key {
        req = match auth {
            Auth::Bearer => req.bearer_auth(k),
            Auth::AnthropicKey => req.header("x-api-key", k).header("anthropic-version", "2023-06-01"),
            Auth::None => req,
        };
    }

    let response = match req.send().await {
        Ok(r) => r,
        Err(e) if e.is_timeout() => {
            return Ok(TestResult { ok: false, message: "Timed out.".into(), models: vec![] })
        }
        Err(e) if e.is_connect() => {
            return Ok(TestResult { ok: false, message: format!("Can't reach {url}"), models: vec![] })
        }
        Err(e) => return Ok(TestResult { ok: false, message: e.to_string(), models: vec![] }),
    };
    let status = response.status();
    if !status.is_success() {
        let message = match status.as_u16() {
            401 | 403 => "The API key was rejected.".to_owned(),
            404 => format!("{url} not found — check the base URL."),
            code => format!("Provider answered HTTP {code}."),
        };
        return Ok(TestResult { ok: false, message, models: vec![] });
    }
    let json: serde_json::Value = response.json().await.unwrap_or_default();
    let models = parse_models(&json);
    Ok(TestResult { ok: true, message: format!("Connected · {} models", models.len()), models })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_endpoints() {
        assert_eq!(
            models_endpoint("openai", None).unwrap(),
            ("https://api.openai.com/v1/models".into(), Auth::Bearer)
        );
        assert_eq!(
            models_endpoint("anthropic", None).unwrap(),
            ("https://api.anthropic.com/v1/models".into(), Auth::AnthropicKey)
        );
        assert_eq!(
            models_endpoint("ollama", Some("http://10.0.0.5:11434/")).unwrap(),
            ("http://10.0.0.5:11434/api/tags".into(), Auth::None)
        );
        assert_eq!(
            models_endpoint("custom", Some("https://llm.example.com/v1")).unwrap().0,
            "https://llm.example.com/v1/models"
        );
    }

    #[test]
    fn rejects_bad_input() {
        assert!(models_endpoint("custom", None).is_err());
        assert!(models_endpoint("openai", Some("file:///etc/passwd")).is_err());
        assert!(models_endpoint("openai", Some("https://x.com/a b")).is_err());
        assert!(models_endpoint("nope", None).is_err());
    }

    #[test]
    fn parses_model_lists() {
        let openai = serde_json::json!({ "data": [{ "id": "gpt-4o" }, { "id": "gpt-4o-mini" }] });
        assert_eq!(parse_models(&openai), vec!["gpt-4o", "gpt-4o-mini"]);
        let ollama = serde_json::json!({ "models": [{ "name": "llama3:8b" }] });
        assert_eq!(parse_models(&ollama), vec!["llama3:8b"]);
        assert!(parse_models(&serde_json::json!({})).is_empty());
    }
}
