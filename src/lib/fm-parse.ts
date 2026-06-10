// src/lib/fm-parse.ts
// Tolerant parser for the PDF-extracted FM markdown.
// Faithful TypeScript port of the prototype parser — keep in sync so that
// section anchor ids produced here match those rendered in the reader.

export type Block =
  | { type: "h"; level: number; text: string; id: string; chap?: boolean }
  | { type: "p"; html: string }
  | { type: "li"; html: string }
  | { type: "fig"; kind: "table" | "figure"; label: string; text: string }
  | { type: "tr"; cells: string[] };

export interface TocEntry {
  id: string;
  level: number;
  text: string;
  chap?: boolean;
}
export interface ParsedFM {
  meta: { date: string; restriction: string };
  blocks: Block[];
  toc: TocEntry[];
}

const MONTHS =
  "JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER";

function isFurniture(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\*+\s*\*+$/.test(t)) return true;
  if (/^\*\*[ivxlcdm\d]{1,6}\*\*$/i.test(t)) return true;
  if (/^\*\*FM\s*[\dA-Z.\-]+\*\*$/i.test(t)) return true;
  if (
    new RegExp(`^\\*\\*?\\d{1,2}\\s+(${MONTHS})\\s+\\d{4}\\*?\\*?$`, "i").test(
      t,
    )
  )
    return true;
  if (/^#+\s*This page intentionally left blank\.?$/i.test(t)) return true;
  if (/^#*\s*\*?\*?(Contents|Page)\*?\*?$/i.test(t)) return true;
  return false;
}
function isRunHeader(t: string): boolean {
  return (
    /^\*\*Chapter\s+[\dA-Z]+\*\*$/i.test(t) ||
    /^\*\*Appendix\s+[A-Z]\*\*$/i.test(t) ||
    /^\*\*[A-Z][A-Za-z].{0,40}\(INCL\s+C\d\)\*\*$/i.test(t)
  );
}
function isLeaderLine(line: string): boolean {
  return /\.{4,}\s*\d*\s*$/.test(line) || /\.{6,}\s*\d*\s*$/.test(line);
}
function figCaption(t: string) {
  const bare = t.replace(/\*\*/g, "").trim();
  const m = bare.match(
    /^(Table|Figure)\s+([A-Za-z]?-?\d+(?:[.\-]\d+)*)\.\s*(.*)$/i,
  );
  if (!m) return null;
  return {
    kind: m[1].toLowerCase() as "table" | "figure",
    label: m[1] + " " + m[2],
    text: (m[3] || "").trim(),
  };
}
const isNumberedPara = (t: string) => /^\d+[-–]\d+\.\s/.test(t);
const isBullet = (t: string) => /^([-*•‣◦]|\d+[.)])\s+/.test(t);
function looksSentence(t: string): boolean {
  const x = t.replace(/\*+/g, "").trim();
  return x.length >= 55 && /[a-z]/.test(x) && /[.:;,)]$/.test(x);
}
function cleanHeading(raw: string): string {
  return raw
    .replace(/^#+\s*/, "")
    .replace(/\.{2,}\s*\d*\s*$/, "")
    .replace(/\*+/g, "")
    .replace(/^[\s*·•\-–—]+/, "")
    .replace(/\s+$/, "")
    .trim();
}
function isJunkHeading(
  t: string,
  opts: { title?: string; num?: string },
): boolean {
  if (!t) return true;
  if (
    /^(DISTRIBUTION RESTRICTION|HEADQUARTERS|FIELD MANUAL|No\.?\s|This publication|This page|Approved for public|Washington, DC|Send comments)/i.test(
      t,
    )
  )
    return true;
  if (
    /https?:\/\//i.test(t) ||
    /^\(/.test(t) ||
    /army\.mil|train\.army/i.test(t)
  )
    return true;
  if (/^(Figures?|Tables?|Contents|Page|Index)$/i.test(t)) return true;
  if (new RegExp(`^(${MONTHS})\\s+\\d{4}$`, "i").test(t)) return true;
  if (/^FM\s*[\dA-Z.\-]+$/i.test(t)) return true;
  if (
    /^\*?M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\*?$/i.test(t) &&
    t.replace(/\*/g, "").length > 0
  )
    return true;
  if (t.length < 2) return true;
  const norm = (s?: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (opts.title && norm(t) === norm(opts.title)) return true;
  if (opts.num && norm(t) === norm(opts.num)) return true;
  return false;
}
function inline(text: string): string {
  text = text.replace(/\*{4,}/g, (m) => m.slice(0, 3));
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(
      /\b(ADP|ADRP|FM|ATP|JP|AR|DA Form|ATTP)\s(\d[\dA-Z.\-]*)/g,
      '<span class="xref">$1&nbsp;$2</span>',
    );
}

export function parseFM(
  md: string,
  opts: { title?: string; num?: string } = {},
): ParsedFM {
  const lines = md.replace(/\r/g, "").split("\n");

  let date = "",
    restriction = "";
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const t = lines[i].trim();
    if (!date) {
      const m = t.match(
        new RegExp(`(\\d{1,2}\\s+)?(${MONTHS})\\s+(\\d{4})`, "i"),
      );
      if (m)
        date =
          (m[1] || "").trim() +
          (m[1] ? " " : "") +
          m[2].charAt(0) +
          m[2].slice(1).toLowerCase() +
          " " +
          m[3];
    }
    if (!restriction && /distribution is unlimited/i.test(t))
      restriction = "Approved for public release; distribution is unlimited.";
  }

  const blocks: Block[] = [];
  const toc: TocEntry[] = [];
  let para: string[] = [];
  let hid = 0;
  let debris = 0;

  const flushPara = () => {
    if (!para.length) return;
    const text = para
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (text) blocks.push({ type: "p", html: inline(text) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) {
      flushPara();
      continue;
    }
    if (isFurniture(raw) || isRunHeader(t)) {
      flushPara();
      continue;
    }
    if (isLeaderLine(raw) && !isBullet(t)) {
      flushPara();
      continue;
    }

    const fig = figCaption(t);
    if (fig) {
      flushPara();
      blocks.push({ type: "fig", ...fig });
      debris = 1;
      continue;
    }
    if (debris > 0) {
      const isHeadingLine = /^#{1,6}\s/.test(raw);
      if (
        isHeadingLine ||
        /^\|.*\|/.test(raw) ||
        isNumberedPara(t) ||
        isBullet(t) ||
        looksSentence(t) ||
        debris > 90
      )
        debris = 0;
      else {
        debris++;
        continue;
      }
    }

    if (/^\|.*\|/.test(t)) {
      flushPara();
      if (/^[\s|:\-]+$/.test(t)) continue;
      const cells = t
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => inline(c.trim()));
      blocks.push({ type: "tr", cells });
      continue;
    }

    const hm = raw.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      flushPara();
      const level = Math.min(hm[1].length, 3);
      const text = cleanHeading(hm[2]);
      if (isJunkHeading(text, opts)) continue;
      const prevH =
        blocks.length && blocks[blocks.length - 1].type === "h"
          ? (blocks[blocks.length - 1] as any)
          : null;
      if (prevH && prevH.text === text) continue;
      const isChapLabel = /^(chapter|appendix|part)\s+[\w.\-]+$/i.test(text);
      const isChapter =
        isChapLabel ||
        /^(chapter|appendix|section|part)\b/i.test(text) ||
        /^(preface|introduction|acknowledgements?|glossary|references|index|foreword|summary of changes)$/i.test(
          text,
        );
      const lvl = isChapter ? 1 : level;
      const id = "h" + ++hid;
      blocks.push({ type: "h", level: lvl, text, id, chap: isChapLabel });
      if (lvl <= 2) toc.push({ id, level: lvl, text, chap: isChapLabel });
      continue;
    }

    if (isBullet(t)) {
      flushPara();
      blocks.push({
        type: "li",
        html: inline(t.replace(/^([-*•‣◦]|\d+[.)])\s+/, "")),
      });
      continue;
    }

    para.push(t);
  }
  flushPara();

  const mergedToc: TocEntry[] = [];
  for (let i = 0; i < toc.length; i++) {
    const e = toc[i],
      nx = toc[i + 1];
    if (e.chap && nx && !nx.chap) {
      mergedToc.push({ id: e.id, level: 1, text: e.text + " · " + nx.text });
      i++;
    } else mergedToc.push(e);
  }

  return { meta: { date, restriction }, blocks, toc: mergedToc };
}
