//! Streaming chat completions for the AI tools.
//!
//! The webview sends a request (provider, model, system prompt, messages) plus a
//! Tauri `Channel`; Rust reads the API key from the keyring, calls the provider
//! with `stream: true`, and forwards text deltas over the channel as they arrive.
//! Keys never reach the webview, and the webview never chooses a URL other than
//! the provider's base (validated in `ai::provider_base`).
//!
//! Two wire formats cover every provider:
//! - OpenAI-compatible `/chat/completions` (OpenAI, OpenRouter, Ollama's `/v1`, custom)
//! - Anthropic `/v1/messages`
//!
//! Both stream Server-Sent Events; `SseLines` + the two `parse_*` functions are pure and tested.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{async_runtime::JoinHandle, ipc::Channel, State};

use super::ai::{auth_for, provider_base, read_key, static_provider, Auth};
use crate::error::{Error, Result};

const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 4096;
const MAX_INPUT_CHARS: usize = 400_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    role: Role,
    content: String,
}

/// Mirrors `AiChatRequest` in `src/core/platform/commands.ts`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    /// Chosen by the webview so it can cancel; `[A-Za-z0-9-]`, ≤ 64 chars.
    id: String,
    provider: String,
    model: String,
    base_url: Option<String>,
    #[serde(default)]
    system: String,
    messages: Vec<ChatMessage>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
}

/// Sent over the channel. Mirrors `AiStreamEvent` in `commands.ts`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    Delta { text: String },
    #[serde(rename_all = "camelCase")]
    Done { stop_reason: Option<String> },
    Error { message: String },
}

/// Running requests by id, so `ai_cancel` can stop them.
#[derive(Default)]
pub struct AiTasks(Mutex<HashMap<String, JoinHandle<()>>>);

fn validate(req: &ChatRequest) -> Result<()> {
    let bad = |m: &str| Err(Error::Message(m.to_owned()));
    if req.id.is_empty() || req.id.len() > 64 || !req.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return bad("Invalid request id");
    }
    if req.model.trim().is_empty() || req.model.len() > 200 || req.model.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return bad("Pick a model in Settings → AI providers");
    }
    if req.messages.is_empty() || req.messages.len() > 100 {
        return bad("Nothing to send");
    }
    if req.messages.last().map(|m| m.role) != Some(Role::User) {
        return bad("The last message must be from the user");
    }
    let total = req.system.len() + req.messages.iter().map(|m| m.content.len()).sum::<usize>();
    if total > MAX_INPUT_CHARS {
        return bad("That's too much text to send in one go (400k characters max)");
    }
    if req.max_tokens.is_some_and(|t| t == 0 || t > 64_000) {
        return bad("max_tokens must be between 1 and 64000");
    }
    if req.temperature.is_some_and(|t| !(0.0..=2.0).contains(&t)) {
        return bad("temperature must be between 0 and 2");
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Dialect {
    OpenAi,
    Anthropic,
}

/// URL, dialect and JSON body for a request. Pure, so it's tested.
fn build(provider: &str, base: &str, req: &ChatRequest) -> (String, Dialect, Value) {
    if provider == "anthropic" {
        let mut body = json!({
            "model": req.model,
            "max_tokens": req.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS),
            "stream": true,
            "messages": req.messages,
        });
        if !req.system.is_empty() {
            body["system"] = json!(req.system);
        }
        if let Some(t) = req.temperature {
            body["temperature"] = json!(t);
        }
        return (format!("{base}/v1/messages"), Dialect::Anthropic, body);
    }

    let mut messages = Vec::with_capacity(req.messages.len() + 1);
    if !req.system.is_empty() {
        messages.push(json!({ "role": "system", "content": req.system }));
    }
    messages.extend(req.messages.iter().map(|m| json!(m)));
    // max_tokens / temperature are only sent when asked for: several newer
    // OpenAI models reject them, and every provider has sensible defaults.
    let mut body = json!({ "model": req.model, "stream": true, "messages": messages });
    if let Some(t) = req.max_tokens {
        body["max_tokens"] = json!(t);
    }
    if let Some(t) = req.temperature {
        body["temperature"] = json!(t);
    }
    // Ollama serves the OpenAI-compatible API under /v1; the others' bases already include it.
    let path = if provider == "ollama" { "/v1/chat/completions" } else { "/chat/completions" };
    (format!("{base}{path}"), Dialect::OpenAi, body)
}

/// Splits a byte stream into SSE `data:` payloads. Works on bytes so a UTF-8
/// character split across network chunks is never decoded half-way.
#[derive(Default)]
struct SseLines {
    buf: Vec<u8>,
}

impl SseLines {
    fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.buf.extend_from_slice(chunk);
        let mut out = Vec::new();
        while let Some(pos) = self.buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = self.buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line);
            let line = line.trim_end_matches(['\r', '\n']);
            if let Some(data) = line.strip_prefix("data:") {
                out.push(data.trim_start().to_owned());
            }
        }
        out
    }
}

#[derive(Debug, PartialEq)]
enum Parsed {
    Text(String),
    Stop(Option<String>),
    Error(String),
    Skip,
}

fn parse_openai(data: &str) -> Parsed {
    if data == "[DONE]" {
        return Parsed::Stop(None);
    }
    let Ok(v) = serde_json::from_str::<Value>(data) else { return Parsed::Skip };
    if let Some(err) = v.get("error") {
        return Parsed::Error(error_message(err));
    }
    let choice = &v["choices"][0];
    if let Some(text) = choice["delta"]["content"].as_str().filter(|t| !t.is_empty()) {
        return Parsed::Text(text.to_owned());
    }
    match choice["finish_reason"].as_str() {
        Some(reason) => Parsed::Stop(Some(reason.to_owned())),
        None => Parsed::Skip,
    }
}

fn parse_anthropic(data: &str) -> Parsed {
    let Ok(v) = serde_json::from_str::<Value>(data) else { return Parsed::Skip };
    match v["type"].as_str() {
        Some("content_block_delta") => match v["delta"]["text"].as_str() {
            Some(text) if !text.is_empty() => Parsed::Text(text.to_owned()),
            _ => Parsed::Skip,
        },
        Some("message_delta") => match v["delta"]["stop_reason"].as_str() {
            Some(reason) => Parsed::Stop(Some(reason.to_owned())),
            None => Parsed::Skip,
        },
        Some("error") => Parsed::Error(error_message(&v["error"])),
        _ => Parsed::Skip,
    }
}

/// `{"message": "..."}` or a plain string, as providers send it.
fn error_message(err: &Value) -> String {
    err.get("message")
        .and_then(Value::as_str)
        .or_else(|| err.as_str())
        .unwrap_or("The provider returned an error")
        .to_owned()
}

fn display_name(provider: &str) -> &str {
    match provider {
        "openai" => "OpenAI",
        "anthropic" => "Anthropic",
        "openrouter" => "OpenRouter",
        "ollama" => "Ollama",
        _ => "The provider",
    }
}

/// A short, human message for a non-2xx response.
fn http_error(provider: &str, status: u16, body: &str) -> String {
    let provider = display_name(provider);
    let detail = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| v.get("error").map(error_message))
        .unwrap_or_else(|| body.chars().take(200).collect());
    let hint = match status {
        401 | 403 => " Check the API key in Settings → AI providers.",
        404 => " Check the model name and base URL.",
        429 => " Rate limited or out of credit; try again shortly.",
        _ => "",
    };
    format!("{provider} answered HTTP {status}: {}{hint}", detail.trim())
}

async fn run(provider: &'static str, key: Option<String>, req: ChatRequest, channel: &Channel<StreamEvent>) -> std::result::Result<Option<String>, String> {
    let base = provider_base(provider, req.base_url.as_deref()).map_err(|e| e.to_string())?;
    let (url, dialect, body) = build(provider, &base, &req);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let mut http = client.post(&url).json(&body);
    if let Some(k) = &key {
        http = match auth_for(provider) {
            Auth::Bearer => http.bearer_auth(k),
            Auth::AnthropicKey => http.header("x-api-key", k).header("anthropic-version", ANTHROPIC_VERSION),
            Auth::None => http,
        };
    }
    if provider == "openrouter" {
        http = http.header("X-Title", "Burrow");
    }

    let response = http.send().await.map_err(|e| {
        if e.is_connect() {
            format!("Can't reach {base}. Is it running and online?")
        } else {
            e.to_string()
        }
    })?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(http_error(provider, status.as_u16(), &text));
    }

    let mut sse = SseLines::default();
    let mut stream = response.bytes_stream();
    let mut stop = None;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Connection dropped: {e}"))?;
        for data in sse.push(&chunk) {
            let parsed = match dialect {
                Dialect::OpenAi => parse_openai(&data),
                Dialect::Anthropic => parse_anthropic(&data),
            };
            match parsed {
                Parsed::Text(text) => {
                    // The webview went away (tool closed): stop reading.
                    if channel.send(StreamEvent::Delta { text }).is_err() {
                        return Ok(None);
                    }
                }
                Parsed::Stop(reason) => stop = reason.or(stop),
                Parsed::Error(message) => return Err(message),
                Parsed::Skip => {}
            }
        }
    }
    Ok(stop)
}

/// Start a streaming completion. Returns at once; events arrive on `on_event`
/// and always end with exactly one `done` or `error` (unless cancelled).
#[tauri::command]
pub async fn ai_stream(request: ChatRequest, on_event: Channel<StreamEvent>, tasks: State<'_, Arc<AiTasks>>) -> Result<()> {
    validate(&request)?;
    let provider = static_provider(&request.provider)?;
    let key = read_key(provider)?;
    if key.is_none() && matches!(provider, "openai" | "anthropic" | "openrouter") {
        return Err(Error::Message("No API key saved for this provider. Add one in Settings → AI providers.".into()));
    }

    let id = request.id.clone();
    let registry = Arc::clone(tasks.inner());
    let task_id = id.clone();
    let handle = tauri::async_runtime::spawn(async move {
        let event = match run(provider, key, request, &on_event).await {
            Ok(stop_reason) => StreamEvent::Done { stop_reason },
            Err(message) => StreamEvent::Error { message },
        };
        let _ = on_event.send(event);
        if let Ok(mut map) = registry.0.lock() {
            map.remove(&task_id);
        }
    });
    if let Ok(mut map) = tasks.0.lock() {
        map.insert(id, handle);
    }
    Ok(())
}

/// Stop a running request (Stop button, or the tool closing).
#[tauri::command]
pub fn ai_cancel(id: String, tasks: State<'_, Arc<AiTasks>>) {
    if let Some(handle) = tasks.0.lock().ok().and_then(|mut map| map.remove(&id)) {
        handle.abort();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(provider: &str) -> ChatRequest {
        ChatRequest {
            id: "req-1".into(),
            provider: provider.into(),
            model: "m-1".into(),
            base_url: None,
            system: "Be brief.".into(),
            messages: vec![ChatMessage { role: Role::User, content: "Hi".into() }],
            max_tokens: None,
            temperature: None,
        }
    }

    #[test]
    fn validates_requests() {
        assert!(validate(&request("openai")).is_ok());
        let mut r = request("openai");
        r.id = "../x".into();
        assert!(validate(&r).is_err());
        let mut r = request("openai");
        r.model = " ".into();
        assert!(validate(&r).is_err());
        let mut r = request("openai");
        r.messages.push(ChatMessage { role: Role::Assistant, content: "x".into() });
        assert!(validate(&r).is_err());
        let mut r = request("openai");
        r.messages[0].content = "x".repeat(MAX_INPUT_CHARS + 1);
        assert!(validate(&r).is_err());
        let mut r = request("openai");
        r.temperature = Some(3.0);
        assert!(validate(&r).is_err());
    }

    #[test]
    fn builds_openai_style_bodies() {
        let (url, dialect, body) = build("openai", "https://api.openai.com/v1", &request("openai"));
        assert_eq!(url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(dialect, Dialect::OpenAi);
        assert_eq!(body["messages"][0], json!({ "role": "system", "content": "Be brief." }));
        assert_eq!(body["messages"][1], json!({ "role": "user", "content": "Hi" }));
        assert_eq!(body["stream"], json!(true));
        assert!(body.get("max_tokens").is_none() && body.get("temperature").is_none());

        let (url, ..) = build("ollama", "http://localhost:11434", &request("ollama"));
        assert_eq!(url, "http://localhost:11434/v1/chat/completions");
    }

    #[test]
    fn builds_anthropic_bodies() {
        let (url, dialect, body) = build("anthropic", "https://api.anthropic.com", &request("anthropic"));
        assert_eq!(url, "https://api.anthropic.com/v1/messages");
        assert_eq!(dialect, Dialect::Anthropic);
        assert_eq!(body["system"], json!("Be brief."));
        assert_eq!(body["max_tokens"], json!(DEFAULT_MAX_TOKENS));
        assert_eq!(body["messages"], json!([{ "role": "user", "content": "Hi" }]));
    }

    #[test]
    fn splits_sse_across_chunks_and_utf8() {
        let mut sse = SseLines::default();
        let full = "data: {\"t\":\"héllo\"}\r\n\nevent: ping\ndata: [DONE]\n".as_bytes();
        // Split inside the two-byte "é".
        let cut = full.iter().position(|&b| b == 0xC3).unwrap() + 1;
        assert!(sse.push(&full[..cut]).is_empty());
        assert_eq!(sse.push(&full[cut..]), vec!["{\"t\":\"héllo\"}", "[DONE]"]);
    }

    #[test]
    fn parses_openai_chunks() {
        assert_eq!(
            parse_openai(r#"{"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}"#),
            Parsed::Text("Hi".into())
        );
        assert_eq!(parse_openai(r#"{"choices":[{"delta":{},"finish_reason":"stop"}]}"#), Parsed::Stop(Some("stop".into())));
        assert_eq!(parse_openai("[DONE]"), Parsed::Stop(None));
        assert_eq!(parse_openai(r#"{"error":{"message":"bad"}}"#), Parsed::Error("bad".into()));
        assert_eq!(parse_openai("not json"), Parsed::Skip);
    }

    #[test]
    fn parses_anthropic_events() {
        assert_eq!(
            parse_anthropic(r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}"#),
            Parsed::Text("Hi".into())
        );
        assert_eq!(
            parse_anthropic(r#"{"type":"message_delta","delta":{"stop_reason":"max_tokens"}}"#),
            Parsed::Stop(Some("max_tokens".into()))
        );
        assert_eq!(
            parse_anthropic(r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#),
            Parsed::Error("Overloaded".into())
        );
        assert_eq!(parse_anthropic(r#"{"type":"ping"}"#), Parsed::Skip);
    }

    #[test]
    fn explains_http_errors() {
        let m = http_error("anthropic", 401, r#"{"type":"error","error":{"message":"invalid x-api-key"}}"#);
        assert!(m.contains("401") && m.contains("invalid x-api-key") && m.contains("Settings"));
        assert!(http_error("openai", 500, "oops").contains("oops"));
    }

    #[test]
    fn serialises_events_for_the_webview() {
        let v = serde_json::to_value(StreamEvent::Done { stop_reason: Some("stop".into()) }).unwrap();
        assert_eq!(v, json!({ "type": "done", "stopReason": "stop" }));
        let v = serde_json::to_value(StreamEvent::Delta { text: "x".into() }).unwrap();
        assert_eq!(v, json!({ "type": "delta", "text": "x" }));
    }

    /// End to end against a local server: HTTP, a chunked SSE body split in odd
    /// places (mid-line and mid-UTF-8), parsing, and the events sent to the webview.
    #[test]
    fn streams_from_a_local_openai_compatible_server() {
        use std::io::{Read, Write};
        use std::sync::Mutex as StdMutex;

        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut conn, _) = listener.accept().unwrap();
            let mut buf = [0u8; 8192];
            let n = conn.read(&mut buf).unwrap();
            let head = String::from_utf8_lossy(&buf[..n]).to_string();
            let body = concat!(
                "data: {\"choices\":[{\"delta\":{\"content\":\"Héllo\"}}]}\n\n",
                ": keep-alive\n\n",
                "data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n",
                "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
                "data: [DONE]\n\n",
            )
            .as_bytes();
            conn.write_all(b"HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\nconnection: close\r\n\r\n").unwrap();
            for piece in body.chunks(7) {
                conn.write_all(piece).unwrap();
                conn.flush().unwrap();
                std::thread::sleep(std::time::Duration::from_millis(2));
            }
            head
        });

        let events: Arc<StdMutex<Vec<String>>> = Arc::default();
        let sink = Arc::clone(&events);
        let channel: Channel<StreamEvent> = Channel::new(move |body| {
            if let tauri::ipc::InvokeResponseBody::Json(json) = body {
                sink.lock().unwrap().push(json);
            }
            Ok(())
        });

        let mut req = request("custom");
        req.base_url = Some(format!("http://127.0.0.1:{port}/v1"));
        let stop = tauri::async_runtime::block_on(run("custom", Some("sk-test".into()), req, &channel)).unwrap();
        let head = server.join().unwrap();

        assert_eq!(stop.as_deref(), Some("stop"));
        assert!(head.starts_with("POST /v1/chat/completions"));
        assert!(head.to_lowercase().contains("authorization: bearer sk-test"));
        let text: String = events
            .lock()
            .unwrap()
            .iter()
            .filter_map(|e| serde_json::from_str::<Value>(e).ok())
            .filter_map(|v| v["text"].as_str().map(String::from))
            .collect();
        assert_eq!(text, "Héllo world");
    }

    #[test]
    fn reports_http_errors_from_the_server() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            let (mut conn, _) = listener.accept().unwrap();
            let mut buf = [0u8; 8192];
            let _ = conn.read(&mut buf);
            let body = r#"{"error":{"message":"model not found"}}"#;
            let _ = write!(conn, "HTTP/1.1 404 Not Found\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
        });
        let channel: Channel<StreamEvent> = Channel::new(|_| Ok(()));
        let mut req = request("custom");
        req.base_url = Some(format!("http://127.0.0.1:{port}/v1"));
        let err = tauri::async_runtime::block_on(run("custom", None, req, &channel)).unwrap_err();
        assert!(err.contains("404") && err.contains("model not found"), "{err}");
    }
}
