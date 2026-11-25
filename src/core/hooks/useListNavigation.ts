import { useCallback, useEffect, useState } from "react";

/**
 * Arrow-key selection over a list. Resets to the first item when `count` or
 * `resetKey` changes. Returns the active index and a keydown handler to attach
 * to the search input.
 */
export function useListNavigation(
  count: number,
  onPick: (index: number) => void,
  resetKey?: unknown,
) {
  const [active, setActive] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is an intentional trigger
  useEffect(() => setActive(0), [count, resetKey]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (count === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % count);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + count) % count);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onPick(active);
      }
    },
    [count, active, onPick],
  );

  return { active, setActive, onKeyDown };
}
