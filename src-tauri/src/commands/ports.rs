//! Port inspector: lists listening TCP sockets by reading `/proc` directly
//! (no `ss`/`lsof` dependency, no root needed).
//!
//! Processes owned by other users show up with `pid: None` — the kernel only
//! lets us map socket inodes to PIDs for our own processes.

use std::{collections::HashMap, fs, net::Ipv4Addr, net::Ipv6Addr};

use serde::Serialize;

use crate::error::{Error, Result};

const TCP_LISTEN: &str = "0A";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListeningPort {
    pub port: u16,
    pub address: String,
    pub protocol: &'static str,
    pub pid: Option<u32>,
    pub process: Option<String>,
    pub command: Option<String>,
}

#[tauri::command]
pub fn list_listening_ports() -> Result<Vec<ListeningPort>> {
    let owners = socket_owners();
    let mut ports = Vec::new();
    for (path, proto) in [("/proc/net/tcp", "tcp"), ("/proc/net/tcp6", "tcp6")] {
        let Ok(table) = fs::read_to_string(path) else { continue };
        for entry in parse_proc_net(&table) {
            let owner = owners.get(&entry.inode);
            ports.push(ListeningPort {
                port: entry.port,
                address: entry.address,
                protocol: proto,
                pid: owner.map(|o| o.0),
                process: owner.map(|o| o.1.clone()),
                command: owner.and_then(|o| o.2.clone()),
            });
        }
    }
    ports.sort_by(|a, b| a.port.cmp(&b.port).then(a.protocol.cmp(b.protocol)));
    ports.dedup_by(|a, b| a.port == b.port && a.pid == b.pid && a.address == b.address);
    Ok(ports)
}

/// Send SIGTERM (or SIGKILL when `force`) to a process the user owns.
#[tauri::command]
pub fn kill_process(pid: u32, force: bool) -> Result<()> {
    if pid <= 1 {
        return Err(Error::Message("Refusing to signal that process.".into()));
    }
    let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
    // SAFETY: kill(2) with a validated positive pid and a standard signal.
    let rc = unsafe { libc::kill(pid as libc::pid_t, signal) };
    if rc == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error().into())
    }
}

#[derive(Debug, PartialEq, Eq)]
struct ProcNetEntry {
    address: String,
    port: u16,
    inode: u64,
}

/// Parse the listening rows of `/proc/net/tcp` or `/proc/net/tcp6`.
fn parse_proc_net(table: &str) -> Vec<ProcNetEntry> {
    table
        .lines()
        .skip(1)
        .filter_map(|line| {
            let cols: Vec<&str> = line.split_whitespace().collect();
            let (local, state, inode) = (cols.get(1)?, cols.get(3)?, cols.get(9)?);
            if *state != TCP_LISTEN {
                return None;
            }
            let (addr_hex, port_hex) = local.split_once(':')?;
            Some(ProcNetEntry {
                address: decode_addr(addr_hex)?,
                port: u16::from_str_radix(port_hex, 16).ok()?,
                inode: inode.parse().ok()?,
            })
        })
        .collect()
}

/// The kernel prints each 32-bit word of the address with `%08X` in host
/// (little-endian on x86/ARM) order, so `to_le_bytes` recovers network order.
fn decode_addr(hex: &str) -> Option<String> {
    let words: Vec<u32> = (0..hex.len() / 8)
        .map(|i| u32::from_str_radix(hex.get(i * 8..i * 8 + 8)?, 16).ok())
        .collect::<Option<_>>()?;
    match words.as_slice() {
        [w] => Some(Ipv4Addr::from(w.to_le_bytes()).to_string()),
        [a, b, c, d] => {
            let mut bytes = [0u8; 16];
            for (i, w) in [a, b, c, d].iter().enumerate() {
                bytes[i * 4..i * 4 + 4].copy_from_slice(&w.to_le_bytes());
            }
            let v6 = Ipv6Addr::from(bytes);
            Some(v6.to_ipv4_mapped().map_or_else(|| v6.to_string(), |v4| v4.to_string()))
        }
        _ => None,
    }
}

/// Map socket inode → (pid, process name, command line) for processes we can see.
fn socket_owners() -> HashMap<u64, (u32, String, Option<String>)> {
    let mut map = HashMap::new();
    let Ok(procs) = fs::read_dir("/proc") else { return map };
    for proc_entry in procs.flatten() {
        let Some(pid) = proc_entry.file_name().to_str().and_then(|s| s.parse::<u32>().ok()) else {
            continue;
        };
        let Ok(fds) = fs::read_dir(proc_entry.path().join("fd")) else { continue };
        let mut info: Option<(String, Option<String>)> = None;
        for fd in fds.flatten() {
            let Ok(target) = fs::read_link(fd.path()) else { continue };
            let Some(inode) = target
                .to_str()
                .and_then(|t| t.strip_prefix("socket:["))
                .and_then(|t| t.strip_suffix(']'))
                .and_then(|t| t.parse::<u64>().ok())
            else {
                continue;
            };
            let (name, cmd) = info
                .get_or_insert_with(|| {
                    let name = fs::read_to_string(proc_entry.path().join("comm"))
                        .map(|s| s.trim().to_owned())
                        .unwrap_or_default();
                    let cmd = fs::read(proc_entry.path().join("cmdline")).ok().map(|raw| {
                        String::from_utf8_lossy(&raw).replace('\0', " ").trim().to_owned()
                    });
                    (name, cmd)
                })
                .clone();
            map.insert(inode, (pid, name, cmd));
        }
    }
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:0CEA 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41234 1 0000000000000000 100 0 0 10 0
   1: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41235 1 0000000000000000 100 0 0 10 0
   2: 0100007F:0CEA 0100007F:D2F0 01 00000000:00000000 00:00000000 00000000  1000        0 41299 1 0000000000000000 20 4 30 10 -1";

    #[test]
    fn parses_listening_ipv4_rows_only() {
        let rows = parse_proc_net(SAMPLE);
        assert_eq!(
            rows,
            vec![
                ProcNetEntry { address: "127.0.0.1".into(), port: 3306, inode: 41234 },
                ProcNetEntry { address: "0.0.0.0".into(), port: 8080, inode: 41235 },
            ]
        );
    }

    #[test]
    fn decodes_ipv6_any_and_loopback() {
        assert_eq!(decode_addr("00000000000000000000000000000000").as_deref(), Some("::"));
        assert_eq!(decode_addr("00000000000000000000000001000000").as_deref(), Some("::1"));
    }
}
