import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Markdown → sanitised HTML. Always sanitise: pasted or opened markdown is
 * untrusted and may contain raw HTML/script.
 */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
