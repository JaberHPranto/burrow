//! One module per tool that needs native access. Register new handlers in `lib.rs`.

pub mod app;
pub mod capture;
pub mod deps;
pub mod files;
pub mod ocr;
pub mod ports;
