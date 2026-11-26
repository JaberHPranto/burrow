import { useWindowSize } from "@/core/platform/window";
import { cx } from "@/core/utils/cx";
import {
  Bot,
  ClipboardList,
  Database,
  Keyboard,
  Palette,
  PanelTop,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { AiProviders } from "./sections/AiProviders";
import { Appearance } from "./sections/Appearance";
import { Clipboard } from "./sections/Clipboard";
import { Data } from "./sections/Data";
import { General } from "./sections/General";
import { Hotkeys } from "./sections/Hotkeys";
import { Tray } from "./sections/Tray";
import styles from "./settings.module.css";

/** Add a section: write a component in ./sections and list it here. */
const SECTIONS = [
  { id: "general", label: "General", icon: SlidersHorizontal, Component: General },
  { id: "appearance", label: "Appearance", icon: Palette, Component: Appearance },
  { id: "hotkeys", label: "Hotkeys", icon: Keyboard, Component: Hotkeys },
  { id: "tray", label: "Tray", icon: PanelTop, Component: Tray },
  { id: "ai", label: "AI providers", icon: Bot, Component: AiProviders },
  { id: "clipboard", label: "Clipboard", icon: ClipboardList, Component: Clipboard },
  { id: "data", label: "Data", icon: Database, Component: Data },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function SettingsView({ initialInput }: { initialInput?: string }) {
  useWindowSize(940, 640);
  const start = SECTIONS.find((s) => s.id === initialInput)?.id ?? "general";
  const [active, setActive] = useState<SectionId>(start);
  const { Component } = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Settings sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cx(styles.navItem, active === id && styles.navActive)}
            aria-current={active === id ? "page" : undefined}
            onClick={() => setActive(id)}
          >
            <Icon aria-hidden />
            {label}
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        <Component />
      </div>
    </div>
  );
}
