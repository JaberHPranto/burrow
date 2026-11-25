import { useClipHistory } from "@/core/clipboard/historyStore";
import { type ClipboardBridgeStatus, commands } from "@/core/platform/commands";
import { CLIPBOARD_SIZES } from "@/core/settings/settings";
import { useSettings } from "@/core/settings/store";
import { Button, Select, Switch, Tag, toast } from "@/design";
import { Check, Download, Puzzle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Section, SettingRow } from "../Section";
import styles from "../settings.module.css";

function bridgeLabel(s: ClipboardBridgeStatus): {
  text: string;
  tone: "mint" | "butter" | "coral";
} {
  if (s.lastSeenSecsAgo !== null) return { text: "Connected", tone: "mint" };
  if (s.installed && s.enabled)
    return { text: "Installed — log out and back in to start it", tone: "butter" };
  if (s.installed) return { text: "Installed but disabled", tone: "butter" };
  return { text: "Not installed", tone: "coral" };
}

export function Clipboard() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const count = useClipHistory((s) => s.items.length);
  const clearUnpinned = useClipHistory((s) => s.clearUnpinned);
  const [bridge, setBridge] = useState<ClipboardBridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => setBridge(await commands.clipboardBridgeStatus()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clip = settings.clipboard;
  const setClip = (patch: Partial<typeof clip>) => update({ clipboard: { ...clip, ...patch } });

  async function install() {
    setBusy(true);
    try {
      toast.success(await commands.installClipboardExtension());
      await refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function uninstall() {
    await commands.uninstallClipboardExtension();
    await refresh();
    toast.success("Extension removed");
  }

  const label = bridge ? bridgeLabel(bridge) : null;

  return (
    <Section
      title="Clipboard history"
      description="Keeps what you copy so you can find and re-copy it later. Stored only on this computer."
    >
      <SettingRow
        label="Record clipboard"
        help="Off = nothing new is saved. Existing history stays until you clear it."
      >
        <Switch
          label="Record clipboard"
          checked={clip.enabled}
          onChange={(enabled) => setClip({ enabled })}
        />
      </SettingRow>
      <SettingRow label="Keep up to" help="Pinned items don't count and are never removed.">
        <Select
          aria-label="History size"
          className={styles.narrowSelect}
          value={clip.maxItems}
          onChange={(e) => setClip({ maxItems: Number(e.target.value) })}
        >
          {CLIPBOARD_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} items
            </option>
          ))}
        </Select>
      </SettingRow>
      <SettingRow
        label="Skip secrets"
        help="Don't save API keys, tokens, one-time codes, private keys or random-looking passwords. Copies from password managers are always skipped."
      >
        <Switch
          label="Skip secrets"
          checked={clip.ignoreSecrets}
          onChange={(ignoreSecrets) => setClip({ ignoreSecrets })}
        />
      </SettingRow>

      <div className={styles.bridge}>
        <div className={styles.bridgeHead}>
          <Puzzle aria-hidden />
          <strong>Background recording</strong>
          {label && <Tag tone={label.tone}>{label.text}</Tag>}
        </div>
        <p className={styles.rowHelp}>
          GNOME doesn't let apps watch the clipboard in the background, so Burrow uses a tiny GNOME
          Shell extension that forwards each copy to Burrow (nothing else: no storage, no network).
          Without it, Burrow still saves whatever is on your clipboard each time you open the
          launcher.
        </p>
        <div className={styles.inline}>
          {bridge?.installed ? (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={uninstall}>
              Remove extension
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={Download} onClick={install} disabled={busy}>
              Install extension
            </Button>
          )}
          {bridge?.installed && bridge.lastSeenSecsAgo === null && (
            <span className={styles.rowHelp}>
              After installing, log out and back in once (GNOME on Wayland loads extensions at
              login).
            </span>
          )}
          {bridge?.lastSeenSecsAgo !== null && bridge?.lastSeenSecsAgo !== undefined && (
            <span className={styles.rowHelp}>
              <Check aria-hidden className={styles.inlineIcon} /> Last copy received{" "}
              {bridge.lastSeenSecsAgo}s ago
            </span>
          )}
        </div>
      </div>

      <SettingRow label="History" help={`${count} item${count === 1 ? "" : "s"} saved.`}>
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          onClick={clearUnpinned}
          disabled={count === 0}
        >
          Clear (keep pinned)
        </Button>
      </SettingRow>
    </Section>
  );
}
