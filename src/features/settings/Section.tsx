import type { ReactNode } from "react";
import styles from "./settings.module.css";

/** A titled block of settings. */
export function Section({
  title,
  description,
  children,
}: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

/** One setting: label + help on the left, control on the right. */
export function SettingRow({
  label,
  help,
  children,
}: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {help && <span className={styles.rowHelp}>{help}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}
