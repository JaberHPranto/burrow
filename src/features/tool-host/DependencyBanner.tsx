import type { Requirement } from "@/core/deps/catalog";
import { reportFor } from "@/core/deps/logic";
import { useDeps } from "@/core/deps/store";
import { cx } from "@/core/utils/cx";
import { Button, CopyButton } from "@/design";
import { PackageX, RefreshCw } from "lucide-react";
import styles from "./DependencyBanner.module.css";

/** Shown at the top of a tool when packages it needs (or benefits from) are missing. */
export function DependencyBanner({ requires }: { requires: readonly Requirement[] | undefined }) {
  const status = useDeps((s) => s.status);
  const checking = useDeps((s) => s.checking);
  const refresh = useDeps((s) => s.refresh);
  const report = reportFor(requires, status);
  if (!report.installCommand) return null;

  const items = [...report.missing, ...report.extras];
  return (
    <div
      className={cx(
        styles.banner,
        report.level === "required" ? styles.required : styles.recommended,
      )}
    >
      <PackageX aria-hidden className={styles.icon} />
      <div className={styles.body}>
        <ul className={styles.list}>
          {items.map((m) => (
            <li key={m.id}>
              <strong>{m.dependency.name}</strong> <span className={styles.level}>{m.level}</span> —{" "}
              {m.why}
            </li>
          ))}
        </ul>
        <code className={styles.command}>{report.installCommand}</code>
      </div>
      <div className={styles.actions}>
        <CopyButton value={report.installCommand} size="sm" variant="secondary" />
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={refresh} disabled={checking}>
          {checking ? "Checking…" : "Re-check"}
        </Button>
      </div>
    </div>
  );
}
