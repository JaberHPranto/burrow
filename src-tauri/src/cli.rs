//! Command-line actions. Bind these to GNOME custom shortcuts, e.g.
//! `burrow --toggle` (launcher) or `burrow --tool json-formatter`.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    /// Started without flags (e.g. autostart): stay in the tray.
    Background,
    /// Show the launcher if hidden, hide it if visible.
    Toggle,
    /// Show the launcher and open a tool by id.
    OpenTool(String),
}

pub fn parse(argv: &[String]) -> Action {
    let mut args = argv.iter().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--toggle" | "-t" => return Action::Toggle,
            "--tool" => {
                if let Some(id) = args.next().filter(|id| is_valid_tool_id(id)) {
                    return Action::OpenTool(id.clone());
                }
            }
            other => {
                if let Some(id) = other.strip_prefix("--tool=").filter(|id| is_valid_tool_id(id)) {
                    return Action::OpenTool(id.to_owned());
                }
            }
        }
    }
    Action::Background
}

/// Tool ids are kebab-case; anything else is ignored.
fn is_valid_tool_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(args: &[&str]) -> Vec<String> {
        std::iter::once("burrow").chain(args.iter().copied()).map(String::from).collect()
    }

    #[test]
    fn parses_actions() {
        assert_eq!(parse(&argv(&[])), Action::Background);
        assert_eq!(parse(&argv(&["--toggle"])), Action::Toggle);
        assert_eq!(parse(&argv(&["--tool", "json-formatter"])), Action::OpenTool("json-formatter".into()));
        assert_eq!(parse(&argv(&["--tool=port-inspector"])), Action::OpenTool("port-inspector".into()));
    }

    #[test]
    fn rejects_bad_tool_ids() {
        assert_eq!(parse(&argv(&["--tool", "../etc"])), Action::Background);
        assert_eq!(parse(&argv(&["--tool"])), Action::Background);
    }
}
