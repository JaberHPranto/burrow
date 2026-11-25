// Prevents an extra console window on Windows in release. Harmless on Linux.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    burrow_lib::run();
}
