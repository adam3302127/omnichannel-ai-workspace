/**
 * Escapes HTML and converts URLs to clickable links.
 * Safe for Telegram HTML parse_mode and web chat innerHTML.
 */
export function linkify(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );
}
