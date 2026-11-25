import { useApp } from "@/app/store";
import { reportFor } from "@/core/deps/logic";
import { useDeps } from "@/core/deps/store";
import { useListNavigation } from "@/core/hooks/useListNavigation";
import { registry } from "@/core/tools/registry";
import { CATEGORY_LABELS, CATEGORY_ORDER, type ToolDefinition } from "@/core/tools/types";
import { cx } from "@/core/utils/cx";
import { Bunny, Chip, IconButton, Kbd, Tag, Tile } from "@/design";
import { Moon, PackageX, Search, Sparkles, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Launcher.module.css";
import { useClipboardSuggestions } from "./useClipboardSuggestions";

interface Section {
  title: string;
  tools: ToolDefinition[];
}

function buildSections(query: string, recents: string[]): Section[] {
  if (query.trim()) {
    const results = registry.search(query);
    return results.length ? [{ title: "Results", tools: results }] : [];
  }
  const sections: Section[] = [];
  const recentTools = recents.map(registry.get).filter((t): t is ToolDefinition => !!t);
  if (recentTools.length) sections.push({ title: "Recent", tools: recentTools });
  for (const category of CATEGORY_ORDER) {
    const inCategory = registry.all().filter((t) => t.category === category);
    if (inCategory.length) sections.push({ title: CATEGORY_LABELS[category], tools: inCategory });
  }
  return sections;
}

export function Launcher({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const recents = useApp((s) => s.recents);
  const openTool = useApp((s) => s.openTool);
  const theme = useApp((s) => s.theme);
  const depStatus = useDeps((s) => s.status);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const { text: clipText, suggestions } = useClipboardSuggestions();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(() => buildSections(query, recents), [query, recents]);
  const flat = useMemo(() => sections.flatMap((s) => s.tools), [sections]);

  const pick = useCallback(
    (i: number) => {
      const tool = flat[i];
      if (tool) openTool(tool.id);
    },
    [flat, openTool],
  );

  const { active, setActive, onKeyDown } = useListNavigation(flat.length, pick, query);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    focus();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onClose();
      return;
    }
    onKeyDown(e);
  }

  let index = -1;

  return (
    <div className={styles.launcher}>
      <header className={styles.header} data-tauri-drag-region>
        <Bunny mood={query && flat.length === 0 ? "oops" : "curious"} size={44} peek />
        <div className={styles.searchWrap}>
          <Search aria-hidden className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.search}
            placeholder="Hop to a tool…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-label="Search tools"
            aria-controls="launcher-list"
            aria-activedescendant={flat[active] ? `tool-${flat[active].id}` : undefined}
          />
        </div>
      </header>

      {suggestions.length > 0 && !query && (
        <div className={styles.suggested} aria-label="Suggested for your clipboard">
          <span className={styles.suggestedLabel}>
            <Sparkles aria-hidden /> From clipboard
          </span>
          {suggestions.map(({ tool, match }) => (
            <Chip
              key={tool.id}
              tone={tool.tone}
              icon={tool.icon}
              onClick={() => openTool(tool.id, { input: clipText })}
            >
              {match.label}
            </Chip>
          ))}
        </div>
      )}

      {/* ARIA combobox pattern: the search input owns this list via aria-activedescendant. */}
      {/* biome-ignore lint/a11y/useSemanticElements: custom listbox with rich options */}
      <div className={styles.list} id="launcher-list" role="listbox" tabIndex={-1} ref={listRef}>
        {flat.length === 0 && (
          <div className={styles.noResults}>
            <p>No tool called “{query}” in this burrow… yet.</p>
          </div>
        )}
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{section.title}</h2>
            {section.tools.map((tool) => {
              index += 1;
              const i = index;
              return (
                // Keyboard selection is handled by the search input (combobox pattern).
                // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the combobox input
                <div
                  key={`${section.title}-${tool.id}`}
                  id={i === active ? `tool-${tool.id}` : undefined}
                  // biome-ignore lint/a11y/useSemanticElements: custom listbox option with rich content
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === active}
                  data-index={i}
                  className={cx(styles.item, i === active && styles.active)}
                  onMouseMove={() => setActive(i)}
                  onClick={() => pick(i)}
                >
                  <Tile icon={tool.icon} tone={tool.tone} round />
                  <div className={styles.itemText}>
                    <span className={styles.itemName}>{tool.name}</span>
                    <span className={styles.itemDesc}>{tool.description}</span>
                  </div>
                  <MissingBadge report={reportFor(tool.requires, depStatus)} />
                  {i === active && <Kbd>↵</Kbd>}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <footer className={styles.footer}>
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span>
          <Kbd>↵</Kbd> open
        </span>
        <span>
          <Kbd>esc</Kbd> close
        </span>
        <span className={styles.brand}>burrow</span>
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={toggleTheme}
        />
      </footer>
    </div>
  );
}

/** "Needs Tesseract" (red) / "Better with gnome-screenshot" (yellow). */
function MissingBadge({ report }: { report: ReturnType<typeof reportFor> }) {
  const first = report.missing[0];
  if (!first) return null;
  const extra = report.missing.length > 1 ? ` +${report.missing.length - 1}` : "";
  return (
    <span title={report.installCommand}>
      <Tag tone={first.level === "required" ? "coral" : "butter"} icon={PackageX}>
        {first.level === "required" ? "Needs" : "Better with"} {first.dependency.name}
        {extra}
      </Tag>
    </span>
  );
}
