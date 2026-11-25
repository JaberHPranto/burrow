import { renderMarkdown } from "@/core/markdown/render";
import { cx } from "@/core/utils/cx";
import { type HTMLAttributes, useMemo } from "react";

interface ProseProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML"> {
  /** Untrusted markdown is fine: it's sanitised (DOMPurify) before rendering. */
  markdown: string;
}

/** Rendered markdown with Burrow's typography (headings, lists, code, tables). */
export function Prose({ markdown, className, ...rest }: ProseProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return (
    <article
      className={cx("b-prose", "selectable", className)}
      {...rest}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by renderMarkdown
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
