//! One module per tool that needs native access. Register new handlers in `lib.rs`.

pub mod ai;
pub mod ai_stream;
pub mod app;
pub mod capture;
pub mod clipboard;
pub mod deps;
pub mod files;
pub mod hotkeys;
pub mod ocr;
pub mod ports;
