// scripts/book-convert.ts
// Pure text -> Markdown converters shared by the book ingest scripts. These take
// downloaded public-domain / CC book text (Project Gutenberg .txt, single-page
// HTML such as Standard Ebooks, Internet Archive djvu .txt) and produce rough
// Markdown suitable for the tolerant downstream parser (fm-parse). They perform
// no I/O, so they are unit-tested in scripts/book-convert.test.ts.

/** Strip a leading UTF-8 byte-order mark and normalise CRLF -> LF. */
function normalizeText(s: string): string {
  return s.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}

export const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Strip the Project Gutenberg license header/footer, keeping the work itself. */
export function stripGutenberg(t: string): string {
  t = normalizeText(t);
  const start = t.match(
    /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
  );
  const end = t.match(
    /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
  );
  const s = start ? start.index! + start[0].length : 0;
  const e = end ? end.index! : t.length;
  return t.slice(s, e).trim();
}

/** Light HTML -> Markdown for single-page book HTML (e.g. Standard Ebooks). */
export function htmlToMarkdown(html: string): string {
  let s = normalizeText(html);
  const body = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) s = body[1];
  s = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|head|nav|header|footer)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
      const txt = inner.replace(/<[^>]+>/g, "").trim();
      return `\n\n${"#".repeat(Number(lvl))} ${txt}\n\n`;
    })
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/?(blockquote|section|article|div|ul|ol|em|i|b|strong|span)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(s)
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const HEADING_RE =
  /^(chapter|part|section|book|appendix|introduction|preface|foreword|conclusion)\b/i;

/** Heuristic plain-text -> Markdown: detect chapter/part headings and ALL-CAPS
 *  short lines as headings; everything else becomes paragraphs. The downstream
 *  parser (fm-parse) is tolerant, so rough structure is sufficient for search. */
export function plainTextToMarkdown(raw: string): string {
  const blocks = normalizeText(raw).split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const oneLine = lines.length === 1 ? lines[0] : "";
    const isCaps =
      oneLine.length > 0 &&
      oneLine.length <= 70 &&
      oneLine === oneLine.toUpperCase() &&
      /[A-Z]/.test(oneLine);
    if (oneLine && (HEADING_RE.test(oneLine) || isCaps)) {
      out.push(`## ${oneLine.replace(/\.$/, "")}`);
    } else {
      out.push(lines.join(" "));
    }
  }
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
