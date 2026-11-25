/**
 * The shared screen behind every AI tool: input on the left, streamed reply on
 * the right, the preset's options on top. A tool supplies only an `AiPreset`
 * (prompt + options), so adding an AI tool is a few lines.
 */
import { useApp } from "@/app/store";
import { handoff } from "@/core/handoff";
import { clipboard } from "@/core/platform/clipboard";
import { useWindowSize } from "@/core/platform/window";
import { useSettings } from "@/core/settings/store";
import { usePersistentState } from "@/core/storage/usePersistentState";
import { cx } from "@/core/utils/cx";
import {
  Button,
  Chip,
  CopyButton,
  EmptyState,
  ErrorNote,
  Kbd,
  Prose,
  Select,
  TextArea,
} from "@/design";
import { ArrowLeftToLine, Bot, RotateCcw, Sparkles, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./AiToolView.module.css";
import {
  type AiOption,
  type AiOptionValues,
  type AiPreset,
  normaliseOptions,
  resolveAiTarget,
} from "./ai";
import { useAiStream } from "./useAiStream";

/** What another tool hands over: `handoff.put("<ai-tool-id>:input", { text, run: true })`. */
export interface AiHandoff {
  text: string;
  run?: boolean;
}

const MAX_CLIPBOARD_PREFILL = 50_000;
const CUT_OFF = new Set(["max_tokens", "length"]);

interface Props {
  preset: AiPreset;
  initialInput?: string;
  autoRun?: boolean;
}

export function AiToolView({ preset, initialInput, autoRun }: Props) {
  useWindowSize(960, 620);
  const aiSettings = useSettings((s) => s.settings.ai);
  const settingsLoaded = useSettings((s) => s.loaded);
  const openTool = useApp((s) => s.openTool);
  const target = useMemo(() => resolveAiTarget(aiSettings), [aiSettings]);

  // Input: hand-off from another tool > launcher suggestion > clipboard.
  const [incoming] = useState(() => handoff.take<AiHandoff>(`${preset.id}:input`));
  const [input, setInput] = useState(incoming?.text ?? initialInput ?? "");
  const [fromClipboard, setFromClipboard] = useState(false);
  const [storedOptions, setStoredOptions] = usePersistentState<AiOptionValues>(
    preset.id,
    "options",
    {},
  );
  const options = useMemo(() => normaliseOptions(preset, storedOptions), [preset, storedOptions]);
  const ai = useAiStream();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Prefill from the clipboard once, on open, if nothing else gave us input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on open
  useEffect(() => {
    if (input || preset.prefillFromClipboard === false) return;
    let alive = true;
    void clipboard
      .readText()
      .then((text) => {
        const t = text?.trim() ?? "";
        if (alive && t && t.length <= MAX_CLIPBOARD_PREFILL) {
          setInput(t);
          setFromClipboard(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(() => {
    if (!target.ok || !input.trim()) {
      inputRef.current?.focus();
      return;
    }
    ai.run(target, preset.build(input.trim(), options));
  }, [target, input, preset, options, ai]);

  // Start right away when asked (hand-off with run, or `--run` from a hotkey).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !settingsLoaded || !(incoming?.run || autoRun)) return;
    if (!input.trim()) return;
    autoStarted.current = true;
    if (target.ok) run();
  }, [settingsLoaded, incoming, autoRun, input, target, run]);

  // Ctrl+Enter runs from anywhere in the tool (the text box, after clicking an option…).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  // Esc stops a running reply instead of leaving the tool.
  useEffect(() => {
    if (ai.status !== "streaming") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      ai.stop();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ai]);

  const setOption = (key: string, value: string) => setStoredOptions({ ...options, [key]: value });
  const streaming = ai.status === "streaming";
  const hasReply = ai.text.length > 0;

  return (
    <div className={styles.layout}>
      {preset.options.length > 0 && (
        <div className={styles.options}>
          {preset.options.map((o) => (
            <OptionControl
              key={o.key}
              option={o}
              value={options[o.key] ?? o.default}
              onChange={setOption}
            />
          ))}
        </div>
      )}

      <div className={styles.panes}>
        <section className={styles.pane}>
          <header className={styles.paneHead}>
            <span className={styles.paneLabel}>{preset.inputLabel}</span>
            {fromClipboard && <span className={styles.note}>from your clipboard</span>}
            <span className="b-grow" />
            <span className={styles.note}>{input.length.toLocaleString()} chars</span>
          </header>
          <TextArea
            ref={inputRef}
            className={styles.input}
            value={input}
            placeholder={preset.placeholder}
            spellCheck={false}
            onChange={(e) => {
              setInput(e.target.value);
              setFromClipboard(false);
            }}
            autoFocus
          />
          <div className={styles.actions}>
            {streaming ? (
              <Button variant="secondary" icon={Square} onClick={ai.stop}>
                Stop <Kbd>Esc</Kbd>
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={Sparkles}
                onClick={run}
                disabled={!target.ok || !input.trim()}
              >
                {preset.action} <Kbd>Ctrl</Kbd>
                <Kbd>↵</Kbd>
              </Button>
            )}
            <span className="b-grow" />
            {target.ok && (
              <button
                type="button"
                className={styles.model}
                title="Change in Settings → AI providers"
                onClick={() => openTool("settings", { input: "ai" })}
              >
                <Bot aria-hidden /> {target.providerName} · {target.model}
              </button>
            )}
          </div>
        </section>

        <section
          className={cx(styles.pane, styles.outputPane)}
          aria-live="polite"
          aria-busy={streaming}
        >
          {!target.ok ? (
            <EmptyState
              title={target.reason === "no-provider" ? "Connect an AI provider" : "Pick a model"}
              mood="curious"
            >
              <div className={styles.setup}>
                <p>
                  {target.reason === "no-provider"
                    ? "Add an API key (OpenAI, Anthropic, OpenRouter) or point Burrow at Ollama, then make it the default."
                    : `Choose a model for ${target.providerName}: “Test connection” lists them.`}
                </p>
                <Button variant="primary" onClick={() => openTool("settings", { input: "ai" })}>
                  Open AI settings
                </Button>
              </div>
            </EmptyState>
          ) : (
            <>
              <div className={styles.output}>
                {!hasReply && ai.status === "idle" && (
                  <p className={styles.placeholder}>
                    The result appears here. Press <Kbd>Ctrl</Kbd>+<Kbd>↵</Kbd> to{" "}
                    {preset.action.toLowerCase()}.
                  </p>
                )}
                {!hasReply && streaming && <p className={styles.placeholder}>Thinking…</p>}
                {hasReply &&
                  (preset.output === "markdown" ? (
                    <Prose markdown={ai.text} className={cx(streaming && styles.streaming)} />
                  ) : (
                    <pre className={cx(styles.plain, "selectable", streaming && styles.streaming)}>
                      {ai.text}
                    </pre>
                  ))}
                {ai.status === "error" && ai.error && <ErrorNote>{ai.error}</ErrorNote>}
                {ai.status === "stopped" && <p className={styles.note}>Stopped.</p>}
                {ai.status === "done" && ai.stopReason && CUT_OFF.has(ai.stopReason) && (
                  <p className={styles.note}>The reply hit the length limit and was cut off.</p>
                )}
              </div>
              <div className={styles.actions}>
                <CopyButton value={ai.text} size="sm" disabled={!hasReply || streaming} />
                {preset.reusable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowLeftToLine}
                    disabled={!hasReply || streaming}
                    onClick={() => {
                      setInput(ai.text);
                      setFromClipboard(false);
                    }}
                  >
                    Use as input
                  </Button>
                )}
                <span className="b-grow" />
                {(ai.status === "done" || ai.status === "stopped" || ai.status === "error") && (
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={run}>
                    Retry
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function OptionControl({
  option,
  value,
  onChange,
}: { option: AiOption; value: string; onChange: (key: string, value: string) => void }) {
  if (option.kind === "select") {
    return (
      <div className={styles.option}>
        <span className={styles.optionLabel}>{option.label}</span>
        <Select
          aria-label={option.label}
          className={styles.select}
          value={value}
          onChange={(e) => onChange(option.key, e.target.value)}
        >
          {option.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
    );
  }
  return (
    <fieldset className={styles.option} aria-label={option.label}>
      <span className={styles.optionLabel}>{option.label}</span>
      {option.choices.map((c) => (
        <Chip
          key={c.value}
          active={c.value === value}
          onClick={() => onChange(option.key, c.value)}
        >
          {c.label}
        </Chip>
      ))}
    </fieldset>
  );
}
