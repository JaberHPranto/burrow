//! Command-line actions. Bind these to GNOME custom shortcuts, e.g.
//! `burrow --toggle`, `burrow --tool json-formatter`, `burrow --tool screenshot --run`.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    /// Started without flags (e.g. autostart): stay in the tray.
    Background,
    /// Show the launcher if hidden, hide it if visible.
    Toggle,
    /// Open a tool by id. `run` asks it to start its main action immediately
    /// (capture a screenshot, pick a colour, …) instead of waiting for a click.
    OpenTool { id: String, run: bool },
}

pub fn parse(argv: &[String]) -> Action {
    let run = argv.iter().any(|a| a == "--run");
    let mut args = argv.iter().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--toggle" | "-t" => return Action::Toggle,
            "--tool" => {
                if let Some(id) = args.next().filter(|id| is_valid_tool_id(id)) {
                    return Action::OpenTool { id: id.clone(), run };
                }
            }
            other => {
                if let Some(id) = other.strip_prefix("--tool=").filter(|id| is_valid_tool_id(id)) {
                    return Action::OpenTool { id: id.to_owned(), run };
                }
            }
        }
    }
    Action::Background
}

/// Tool ids are kebab-case; anything else is ignored.
pub fn is_valid_tool_id(id: &str) -> bool {
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

    fn open(id: &str, run: bool) -> Action {
        Action::OpenTool { id: id.into(), run }
    }

    #[test]
    fn parses_actions() {
        assert_eq!(parse(&argv(&[])), Action::Background);
        assert_eq!(parse(&argv(&["--toggle"])), Action::Toggle);
        assert_eq!(parse(&argv(&["--tool", "json-formatter"])), open("json-formatter", false));
        assert_eq!(parse(&argv(&["--tool=port-inspector"])), open("port-inspector", false));
        assert_eq!(parse(&argv(&["--tool", "screenshot", "--run"])), open("screenshot", true));
        assert_eq!(parse(&argv(&["--run", "--tool", "ocr"])), open("ocr", true));
    }

    #[test]
    fn rejects_bad_tool_ids() {
        assert_eq!(parse(&argv(&["--tool", "../etc"])), Action::Background);
        assert_eq!(parse(&argv(&["--tool"])), Action::Background);
    }
}
