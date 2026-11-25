import { commands } from "@/core/platform/commands";
import { parseBackup, storage } from "@/core/storage/storage";
import { Button, CopyButton, FilePicker, toast } from "@/design";
import { Download, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Section, SettingRow } from "../Section";
import styles from "../settings.module.css";

export function Data() {
  const [dir, setDir] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void commands
      .appDataDir()
      .then(setDir)
      .catch(() => setDir(""));
  }, []);

  useEffect(() => {
    if (!confirmReset) return;
    const t = setTimeout(() => setConfirmReset(false), 4000);
    return () => clearTimeout(t);
  }, [confirmReset]);

  async function exportBackup() {
    const backup = await storage.exportAll();
    const date = new Date().toISOString().slice(0, 10);
    const path = await commands.saveJson(
      JSON.stringify(backup, null, 2),
      `burrow-backup-${date}.json`,
    );
    if (path) toast.success(`Backup saved: ${path.split("/").pop()}`);
  }

  async function importBackup(file: File) {
    try {
      const backup = parseBackup(await file.text());
      await storage.importAll(backup);
      toast.success("Backup restored — reloading…");
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function resetAll() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    await storage.clearAll();
    window.location.reload();
  }

  return (
    <Section
      title="Data"
      description="Everything Burrow saves — settings, tasks, notes, clipboard history — lives in one file on this computer. API keys are kept separately in your system keyring and are not part of backups."
    >
      <SettingRow
        label="Storage folder"
        help={<code className={styles.path}>{dir ? `${dir}/burrow.json` : "…"}</code>}
      >
        <CopyButton value={dir} size="sm" variant="secondary" label="Copy path" disabled={!dir} />
      </SettingRow>
      <SettingRow
        label="Export backup"
        help="Save everything to a JSON file you can keep or move to another machine."
      >
        <Button size="sm" icon={Download} onClick={() => void exportBackup()}>
          Export…
        </Button>
      </SettingRow>
      <SettingRow label="Import backup" help="Replaces all current data with the backup's.">
        <FilePicker
          accept=".json,application/json"
          label="Import…"
          size="sm"
          onFile={(f) => void importBackup(f)}
        />
      </SettingRow>
      <SettingRow
        label="Reset Burrow"
        help="Deletes all settings and tool data. API keys and hotkeys are not touched."
      >
        <Button size="sm" variant="danger" icon={RotateCcw} onClick={() => void resetAll()}>
          {confirmReset ? "Click again to erase everything" : "Reset…"}
        </Button>
      </SettingRow>
    </Section>
  );
}
