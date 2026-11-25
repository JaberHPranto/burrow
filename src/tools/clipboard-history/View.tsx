import { useApp } from "@/app/store";
import {
  type ClipItem,
  type ClipKind,
  clipKind,
  preview,
  searchClips,
  sortClips,
} from "@/core/clipboard/history";
import { useClipHistory } from "@/core/clipboard/historyStore";
import { useListNavigation } from "@/core/hooks/useListNavigation";
import { clipboard } from "@/core/platform/clipboard";
import { commands } from "@/core/platform/commands";
import { useSettings } from "@/core/settings/store";
import { cx } from "@/core/utils/cx";
import { Button, EmptyState, IconButton, Input, Kbd, Row, toast } from "@/design";
import {
  Braces,
  Code2,
  Link2,
  type LucideIcon,
  Palette,
  Pin,
  PinOff,
  Search,
  Text,
  TextQuote,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./styles.module.css";

const KIND_ICON: Record<ClipKind, LucideIcon> = {
  url: Link2,
  json: Braces,
  color: Palette,
  code: Code2,
  multiline: TextQuote,
  text: Text,
};

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86_400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86_400)}d`;
}

export default function ClipboardHistory() {
  const items = useClipHistory((s) => s.items);
  const togglePin = useClipHistory((s) => s.togglePin);
  const remove = useClipHistory((s) => s.remove);
  const enabled = useSettings((s) => s.settings.clipboard.enabled);
  const openTool = useApp((s) => s.openTool);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => searchClips(sortClips(items), query), [items, query]);

  const copy = useCallback(async (item: ClipItem) => {
    try {
      await clipboard.writeText(item.text);
      toast.success("Copied — paste it anywhere");
      setTimeout(() => void commands.hideLauncher(), 350);
    } catch {
      toast.error("Couldn't copy");
    }
  }, []);

  const pick = useCallback(
    (i: number) => {
      const item = visible[i];
      if (item) void copy(item);
    },
    [visible, copy],
  );

  const { active, setActive, onKeyDown } = useListNavigation(visible.length, pick, query);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const current = visible[active];

  return (
    <div className={styles.layout}>
      <Row gap={2}>
        <div className="b-grow">
          <Input
            icon={Search}
            placeholder={`Search ${items.length} copied item${items.length === 1 ? "" : "s"}…`}
            aria-label="Search clipboard history"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Delete" && current) {
                e.preventDefault();
                remove(current.id);
              } else if (e.key.toLowerCase() === "p" && e.ctrlKey && current) {
                e.preventDefault();
                togglePin(current.id);
              } else onKeyDown(e);
            }}
            autoFocus
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openTool("settings", { input: "clipboard" })}
        >
          Settings
        </Button>
      </Row>

      {!enabled && (
        <p className={styles.notice}>Recording is paused. Turn it on in Settings → Clipboard.</p>
      )}

      {visible.length === 0 ? (
        <EmptyState title={query ? "Nothing matches" : "Nothing copied yet"} mood="sleepy">
          {query
            ? "Try another word."
            : "Copy something and it shows up here. For background recording, install the clipboard extension in Settings → Clipboard."}
        </EmptyState>
      ) : (
        <div className={styles.split}>
          <ul className={styles.list} ref={listRef}>
            {visible.map((item, i) => {
              const Icon = KIND_ICON[clipKind(item.text)];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-index={i}
                    className={cx(styles.item, i === active && styles.active)}
                    onMouseMove={() => setActive(i)}
                    onClick={() => void copy(item)}
                    title="Click or Enter to copy"
                  >
                    <Icon aria-hidden className={styles.kind} />
                    <span className={styles.text}>{preview(item.text)}</span>
                    {item.pinned && <Pin aria-label="Pinned" className={styles.pin} />}
                    <span className={styles.time}>{ago(item.at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && (
            <aside className={styles.detail}>
              <pre className={cx(styles.full, "selectable")}>{current.text}</pre>
              <div className={styles.meta}>
                {current.text.length.toLocaleString()} chars ·{" "}
                {current.source === "extension" ? "recorded" : "saved on launcher open"}
              </div>
              <Row gap={1}>
                <Button size="sm" variant="primary" onClick={() => void copy(current)}>
                  Copy <Kbd>↵</Kbd>
                </Button>
                <IconButton
                  icon={current.pinned ? PinOff : Pin}
                  label={current.pinned ? "Unpin (Ctrl+P)" : "Pin (Ctrl+P)"}
                  onClick={() => togglePin(current.id)}
                />
                <IconButton icon={Trash2} label="Delete (Del)" onClick={() => remove(current.id)} />
              </Row>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
