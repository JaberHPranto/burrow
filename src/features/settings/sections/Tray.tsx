import { DEFAULT_TRAY, MAX_TRAY_ITEMS } from "@/core/settings/settings";
import { useSettings } from "@/core/settings/store";
import { registry } from "@/core/tools/registry";
import { CATEGORY_LABELS, CATEGORY_ORDER, type ToolDefinition } from "@/core/tools/types";
import { toggleTray, trayCandidates } from "@/core/tray/tray";
import { Button, Switch, Tile } from "@/design";
import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Section } from "../Section";
import styles from "../settings.module.css";

export function Tray() {
  const tray = useSettings((s) => s.settings.tray);
  const update = useSettings((s) => s.update);
  const chosen = useMemo(() => new Set(tray), [tray]);
  const full = tray.length >= MAX_TRAY_ITEMS;

  const groups = useMemo(() => {
    const tools = trayCandidates(registry.all());
    return CATEGORY_ORDER.map((category) => ({
      category,
      tools: tools.filter((t) => t.category === category),
    })).filter((g) => g.tools.length > 0);
  }, []);

  const isDefault =
    tray.length === DEFAULT_TRAY.length && DEFAULT_TRAY.every((id) => chosen.has(id));

  return (
    <Section
      title="Tray"
      description="Pick the tools you use most for quick access from the tray icon's menu. Open Burrow, Settings and Quit are always there."
    >
      <div className={styles.trayHead}>
        <span className={styles.rowHelp}>
          {tray.length === 0 ? "No tools in the tray" : `${tray.length} in the tray`}
          {full && ` (the maximum is ${MAX_TRAY_ITEMS})`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={RotateCcw}
          disabled={isDefault}
          onClick={() => update({ tray: [...DEFAULT_TRAY] })}
        >
          Reset to default
        </Button>
      </div>
      {groups.map(({ category, tools }) => (
        <div key={category} className={styles.trayGroup}>
          <h3 className={styles.groupTitle}>{CATEGORY_LABELS[category]}</h3>
          {tools.map((tool) => (
            <TrayRow
              key={tool.id}
              tool={tool}
              on={chosen.has(tool.id)}
              disabled={full && !chosen.has(tool.id)}
              onChange={(on) => update({ tray: toggleTray(tray, tool.id, on) })}
            />
          ))}
        </div>
      ))}
    </Section>
  );
}

function TrayRow({
  tool,
  on,
  disabled,
  onChange,
}: {
  tool: ToolDefinition;
  on: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const label = tool.tray?.label ?? tool.name;
  return (
    <div className={styles.trayRow}>
      <Tile icon={tool.icon} tone={tool.tone} />
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {tool.tray?.run && <span className={styles.rowHelp}>Starts right away from the tray</span>}
      </div>
      <Switch
        label={`Show ${label} in the tray`}
        checked={on}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
