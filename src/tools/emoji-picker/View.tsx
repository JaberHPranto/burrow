import { clipboard } from "@/core/platform/clipboard";
import { commands } from "@/core/platform/commands";
import { useWindowSize } from "@/core/platform/window";
import { usePersistentState } from "@/core/storage/usePersistentState";
import { cx } from "@/core/utils/cx";
import { Button, EmptyState, ErrorNote, Input, Kbd, toast } from "@/design";
import {
  Apple,
  Clock,
  Flag,
  Hash,
  Lightbulb,
  type LucideIcon,
  PawPrint,
  Plane,
  Search,
  Smile,
  Trophy,
  User,
} from "lucide-react";
import { type KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadEmojis } from "./data";
import {
  type Emoji,
  GROUPS,
  type GridKey,
  type SkinTone,
  codepoints,
  htmlEntity,
  layoutGrid,
  moveInGrid,
  pushRecent,
  resolveRecents,
  searchEmojis,
  supportedOnly,
  withSkin,
} from "./logic";
import styles from "./styles.module.css";
import { detectMaxEmojiVersion } from "./support";

const CELL = 40;
const GAP = 2;
const NAV_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

const GROUP_ICON: Record<(typeof GROUPS)[number]["key"], LucideIcon> = {
  smileys: Smile,
  people: User,
  nature: PawPrint,
  food: Apple,
  travel: Plane,
  activities: Trophy,
  objects: Lightbulb,
  symbols: Hash,
  flags: Flag,
};

const TONE_NAMES = ["Default", "Light", "Medium-light", "Medium", "Medium-dark", "Dark"] as const;

interface Section {
  key: string;
  label: string;
  icon: LucideIcon;
  items: Emoji[];
}

export default function EmojiPicker() {
  useWindowSize(800, 560);
  const [all, setAll] = useState<Emoji[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = usePersistentState<string[]>("emoji-picker", "recents", []);
  const [tone, setTone] = usePersistentState<SkinTone>("emoji-picker", "skin", 0);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [cols, setCols] = useState(16);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEmojis()
      .then((list) => setAll(supportedOnly(list, detectMaxEmojiVersion(list))))
      .catch((err) => setError(String(err)));
  }, []);

  // Columns follow the width, so ↑/↓ match what's on screen.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setCols(Math.max(4, Math.floor((width + GAP) / (CELL + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const byHex = useMemo(() => new Map((all ?? []).map((e) => [e.hexcode, e])), [all]);

  const groups = useMemo<Section[]>(
    () =>
      GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        icon: GROUP_ICON[g.key],
        items: (all ?? []).filter((e) => e.group === g.id),
      })).filter((s) => s.items.length > 0),
    [all],
  );

  const sections = useMemo<Section[]>(() => {
    if (!all) return [];
    if (query.trim()) {
      return [{ key: "results", label: "Results", icon: Search, items: searchEmojis(all, query) }];
    }
    const recent = resolveRecents(recents, byHex);
    return recent.length > 0
      ? [{ key: "recent", label: "Recently used", icon: Clock, items: recent }, ...groups]
      : groups;
  }, [all, query, recents, byHex, groups]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const layout = useMemo(
    () =>
      layoutGrid(
        sections.map((s) => s.items.length),
        cols,
      ),
    [sections, cols],
  );
  const sectionStart = useMemo(() => {
    let i = 0;
    return sections.map((s) => {
      const start = i;
      i += s.items.length;
      return start;
    });
  }, [sections]);

  const current = flat[Math.min(active, flat.length - 1)];
  let currentSection = 0;
  sectionStart.forEach((start, i) => {
    if (start <= active) currentSection = i;
  });

  useEffect(() => {
    gridRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = useCallback(
    async (e: Emoji, keepOpen: boolean) => {
      const text = withSkin(e, tone);
      try {
        await clipboard.writeText(text);
      } catch {
        toast.error("Couldn't copy");
        return;
      }
      setRecents((r) => pushRecent(r, e.hexcode));
      if (keepOpen) {
        toast.success(`Copied ${text}`);
      } else {
        toast.success(`Copied ${text} — paste it anywhere`);
        setTimeout(() => void commands.hideLauncher(), 300);
      }
    },
    [tone, setRecents],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (NAV_KEYS.has(e.key)) {
      e.preventDefault();
      setActive((i) => moveInGrid(i, e.key as GridKey, layout));
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      void pick(current, e.shiftKey);
    } else if (e.key === "Tab" && !e.ctrlKey) {
      // Tab / Shift+Tab: next / previous category.
      e.preventDefault();
      if (query || sections.length === 0) return;
      const next = (currentSection + (e.shiftKey ? -1 : 1) + sections.length) % sections.length;
      jumpTo(next);
    }
  }

  function jumpTo(sectionIndex: number) {
    const start = sectionStart[sectionIndex] ?? 0;
    setActive(start);
    gridRef.current
      ?.querySelector(`[data-section="${sections[sectionIndex]?.key}"]`)
      ?.scrollIntoView({ block: "start" });
    inputRef.current?.focus();
  }

  const onGridClick = (ev: React.MouseEvent) => {
    const index = Number(
      (ev.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index,
    );
    const e = flat[index];
    if (e) void pick(e, ev.shiftKey);
  };
  const onGridHover = (ev: React.MouseEvent) => {
    if (ev.movementX === 0 && ev.movementY === 0) return; // scrolling, not the mouse
    const index = Number(
      (ev.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index,
    );
    if (Number.isFinite(index)) setActive(index);
  };

  const hand = byHex.get("1F44B");

  return (
    <div className={styles.layout}>
      <div className={styles.top}>
        <div className="b-grow">
          <Input
            ref={inputRef}
            icon={Search}
            placeholder={
              all
                ? `Search ${all.length.toLocaleString()} emoji… (try “party” or :tada:)`
                : "Loading…"
            }
            aria-label="Search emoji"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            autoFocus
          />
        </div>
        <fieldset className={styles.tones} aria-label="Skin tone">
          {TONE_NAMES.map((name, t) => (
            <button
              key={name}
              type="button"
              className={cx(styles.tone, tone === t && styles.toneActive)}
              aria-label={`Skin tone: ${name}`}
              aria-pressed={tone === t}
              title={`${name} skin tone`}
              onClick={() => {
                setTone(t as SkinTone);
                inputRef.current?.focus();
              }}
            >
              {hand ? withSkin(hand, t as SkinTone) : "👋"}
            </button>
          ))}
        </fieldset>
      </div>

      {!query && sections.length > 0 && (
        <nav className={styles.tabs} aria-label="Categories">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                className={cx(styles.tab, i === currentSection && styles.tabActive)}
                aria-label={s.label}
                title={s.label}
                onClick={() => jumpTo(i)}
              >
                <Icon aria-hidden />
              </button>
            );
          })}
        </nav>
      )}

      {error && <ErrorNote>Couldn't load emoji: {error}</ErrorNote>}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by the search box */}
      <div
        ref={gridRef}
        className={styles.grid}
        style={
          { "--cols": cols, "--cell": `${CELL}px`, "--gap": `${GAP}px` } as React.CSSProperties
        }
        onClick={onGridClick}
        onMouseMove={onGridHover}
      >
        {all && flat.length === 0 && (
          <EmptyState title="No emoji found" mood="oops">
            Nothing matches “{query}”. Try a simpler word.
          </EmptyState>
        )}
        {sections.map((s, si) => (
          <section key={s.key} data-section={s.key} className={styles.section}>
            <h3 className={styles.sectionTitle}>{s.label}</h3>
            <div className={styles.cells}>
              {s.items.map((e, i) => {
                const index = (sectionStart[si] ?? 0) + i;
                return (
                  <Cell
                    key={e.hexcode}
                    text={withSkin(e, tone)}
                    label={e.label}
                    index={index}
                    active={index === active}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className={styles.preview}>
        {current ? (
          <>
            <span className={styles.big}>{withSkin(current, tone)}</span>
            <div className={styles.info}>
              <strong>{current.label}</strong>
              <span className={styles.meta}>
                {current.shortcodes[0] ? `:${current.shortcodes[0]}: · ` : ""}
                {codepoints(withSkin(current, tone))}
              </span>
            </div>
            <div className={styles.actions}>
              {current.shortcodes[0] && (
                <CopyText label="Shortcode" text={`:${current.shortcodes[0]}:`} />
              )}
              <CopyText label="HTML" text={htmlEntity(withSkin(current, tone))} />
              <Button size="sm" variant="primary" onClick={() => void pick(current, false)}>
                Copy <Kbd>↵</Kbd>
              </Button>
            </div>
          </>
        ) : (
          <span className={styles.meta}>{all ? "" : "Digging up emoji…"}</span>
        )}
      </footer>
      <p className={styles.hint}>
        <Kbd>↵</Kbd> copy &amp; close · <Kbd>Shift</Kbd>+<Kbd>↵</Kbd> copy &amp; keep open ·{" "}
        <Kbd>Tab</Kbd> next category
      </p>
    </div>
  );
}

const Cell = memo(function Cell({
  text,
  label,
  index,
  active,
}: { text: string; label: string; index: number; active: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-index={index}
      className={cx(styles.cell, active && styles.cellActive)}
      aria-label={label}
      title={label}
    >
      {text}
    </button>
  );
});

function CopyText({ label, text }: { label: string; text: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      title={text}
      onClick={() => {
        void clipboard.writeText(text).then(
          () => toast.success(`Copied ${text}`),
          () => toast.error("Couldn't copy"),
        );
      }}
    >
      {label}
    </Button>
  );
}
