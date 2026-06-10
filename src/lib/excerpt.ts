const EXCERPT_RADIUS = 90;

// Pull a short snippet of context around the first match of `q` in `content`.
export function buildExcerpt(content: string, q: string): string | null {
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - EXCERPT_RADIUS);
  const end = Math.min(content.length, idx + q.length + EXCERPT_RADIUS);
  const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "… " : ""}${snippet}${end < content.length ? " …" : ""}`;
}
