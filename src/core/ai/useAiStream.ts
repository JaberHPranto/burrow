import { type AiStreamEvent, commands } from "@/core/platform/commands";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AiPrompt, type AiTarget, newRequestId } from "./ai";

export type AiStatus = "idle" | "streaming" | "done" | "stopped" | "error";

export interface AiStream {
  text: string;
  status: AiStatus;
  error: string | null;
  /** Provider's reason for stopping; "max_tokens"/"length" means the reply was cut off. */
  stopReason: string | null;
  run: (target: Extract<AiTarget, { ok: true }>, prompt: AiPrompt) => void;
  stop: () => void;
}

/**
 * Streams one AI reply at a time. Starting a new run cancels the previous one;
 * unmounting cancels too, so closing a tool never leaves a request running.
 * Deltas are batched to one React update per animation frame.
 */
export function useAiStream(): AiStream {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<AiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const frame = useRef(0);

  const cancel = useCallback(() => {
    const id = current.current;
    current.current = null;
    cancelAnimationFrame(frame.current);
    if (id) void commands.aiCancel(id).catch(() => {});
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback<AiStream["run"]>(
    (target, prompt) => {
      cancel();
      const id = newRequestId();
      current.current = id;
      let acc = "";
      setText("");
      setError(null);
      setStopReason(null);
      setStatus("streaming");

      const onEvent = (event: AiStreamEvent) => {
        if (current.current !== id) return; // a stale or cancelled request
        if (event.type === "delta") {
          acc += event.text;
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => setText(acc));
          return;
        }
        current.current = null;
        cancelAnimationFrame(frame.current);
        setText(acc);
        if (event.type === "done") {
          setStopReason(event.stopReason);
          setStatus("done");
        } else {
          setError(event.message);
          setStatus("error");
        }
      };

      commands
        .aiStream(
          {
            id,
            provider: target.provider,
            model: target.model,
            baseUrl: target.baseUrl,
            system: prompt.system,
            messages: [{ role: "user", content: prompt.user }],
          },
          onEvent,
        )
        .catch((err: unknown) => {
          // Rejected before streaming started (no key, invalid request…).
          if (current.current !== id) return;
          current.current = null;
          setError(err instanceof Error ? err.message : String(err));
          setStatus("error");
        });
    },
    [cancel],
  );

  const stop = useCallback(() => {
    if (!current.current) return;
    cancel();
    setStatus("stopped");
  }, [cancel]);

  return { text, status, error, stopReason, run, stop };
}
