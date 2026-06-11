// src/lib/fm-parse.ts
// Tolerant parser for the PDF-extracted FM markdown.
// Keep in sync with the prototype's reader-parse.js so section anchor ids match.

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

// Hoisted RegExps for hot paths
const FURNITURE_DATE_RE = new RegExp(
  `^\\*\\*?\\d{1,2}\\s+(${MONTHS})\\s+\\d{4}\\*?\\*?$`,
  "i",
);
const JUNK_DATE_RE = new RegExp(`^(${MONTHS})\\s+\\d{4}$`, "i");
const DATE_EXTRACT_RE = new RegExp(
  `(\\d{1,2}\\s+)?(${MONTHS})\\s+(\\d{4})`,
  "i",
);

// P-1: Running footer triplet detection — bold chapter-page refs like **1-1**, **B-9**, **i**
const CHAPTER_PAGE_RE = /^\*\*[\w][\w\-]*\*\*$/;

// P-2: Signature block trigger phrases
const SIG_BLOCK_START_RE =
  /^(By Order of the Secretary of the Army[:.:]?|%\\2UGHURIWKH6HFUHWDU)/i;
// P-2: All-caps name line used as heading (general officer names)
const ALLCAPS_NAME_HEADING_RE = /^[A-Z][A-Z\s.,'\-]{7,}$/;
// P-2: Administrative publication control numbers (7 digits)
const ADMIN_PCN_RE = /^\d{7}$/;
// P-2: Rank lines following a name
const RANK_LINE_RE =
  /^(General|Lieutenant General|Major General|Brigadier General|Colonel|Sergeant Major|Administrative Assistant|Acting Administrative)\b/i;

// P-3: Distribution / supersession lines in front matter
const DISTRO_LINE_RE =
  /^(\*{0,3}DISTRIBUTION[\s_]*(RESTRICTION|STATEMENT|[A-Z]):?|\*{0,3}This publication supersedes\b)/i;

// P-4: Standalone bold roman numeral page markers
const ROMAN_PAGE_RE = /^\*\*(i{1,3}|iv|v|vi{0,3}|ix|x{1,3})\*\*$/i;

// P-5 already handled in isFurniture for "this page intentionally left blank"

// P-6: Publication availability URL headings (armypubs / atiam)
const AVAIL_URL_RE = /army\.mil|atiam\.train\.army|armypubs/i;

// P-7: PIN / PCN lines at end of FM ("1925303" style already covered, also "PIN: 123456")
const PIN_LINE_RE = /^(PIN|PCN|IDN)[\s:]+\d+$/i;

// P-8: "Official:" standalone line in sig block
const OFFICIAL_LINE_RE = /^Official:?$/i;

// P-9: Supersession notice as heading (front matter)
const SUPERSEDES_RE = /^This publication supersedes\b/i;

// P-10: Postal address word-per-line (ATTN: / Fort / Building)
const ADDRESS_LINE_RE =
  /^(ATTN:|Fort\s+\w|Building\s+\d|Redstone Arsenal|APO|FPO|\d{5}(-\d{4})?$)/i;

// P-11: Change tracking '+' prefix lines
const CHANGE_TRACK_RE = /^\+[A-Z][a-z]/;

// P-12: Change transmittal page-swap headers
const PAGE_SWAP_RE = /^\*\*(Remove Old Pages|Insert New Pages)\*\*$/i;

// P-13: Running header underline separator lines
const UNDERLINE_SEP_RE = /^\*\*(FM\s+[\d\-.]+ )?_{10,}\*\*$/;

// P-14: TOC heading with dotted leaders (### Entry .... page)
const TOC_HDR_RE = /^#{1,3}\s+.+\.{4,}\s+\S+\s*$/;

function isFurniture(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\*+\s*\*+$/.test(t)) return true;
  if (/^\*\*[ivxlcdm\d]{1,6}\*\*$/i.test(t)) return true;
  if (/^\*\*FM\s*[\dA-Z.\-]+\*\*$/i.test(t)) return true;
  if (FURNITURE_DATE_RE.test(t)) return true;
  if (/^#+\s*This page intentionally left blank\.?$/i.test(t)) return true;
  if (/^#*\s*\*?\*?(Contents|Page)\*?\*?$/i.test(t)) return true;
  // P-1: chapter-page refs **1-1**, **A-3**, **i**
  if (CHAPTER_PAGE_RE.test(t)) return true;
  // P-7: PIN/PCN lines
  if (PIN_LINE_RE.test(t)) return true;
  // P-8: "Official:" in sig block
  if (OFFICIAL_LINE_RE.test(t)) return true;
  // P-12: page-swap headers
  if (PAGE_SWAP_RE.test(t)) return true;
  // P-13: underline separator lines
  if (UNDERLINE_SEP_RE.test(t)) return true;
  // P-4: standalone bold roman numeral page markers
  if (ROMAN_PAGE_RE.test(t)) return true;
  // P-2: admin PCN numbers
  if (ADMIN_PCN_RE.test(t)) return true;
  // P-3: distribution / supersession lines
  if (DISTRO_LINE_RE.test(t)) return true;
  // P-9: supersession as a standalone line
  if (SUPERSEDES_RE.test(t)) return true;
  // P-11: change tracking lines
  if (CHANGE_TRACK_RE.test(t)) return true;
  // P-10: postal address fragments
  if (ADDRESS_LINE_RE.test(t)) return true;
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
    /^(DISTRIBUTION RESTRICTION|DISTRIBUTION STATEMENT|HEADQUARTERS|FIELD MANUAL|No\.?\s|This publication|This page|Approved for public|Washington, DC|Send comments|By Order of)/i.test(
      t,
    )
  )
    return true;
  // P-6: availability URL headings
  if (AVAIL_URL_RE.test(t)) return true;
  if (/^\(/.test(t)) return true;
  if (/^(Figures?|Tables?|Contents|Page|Index)$/i.test(t)) return true;
  if (JUNK_DATE_RE.test(t)) return true;
  if (/^FM\s*[\dA-Z.\-]+$/i.test(t)) return true;
  // Roman numeral check (structurally valid only)
  if (
    /^\*?M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\*?$/i.test(t) &&
    t.replace(/\*/g, "").length > 0
  )
    return true;
  if (t.length < 2) return true;
  // P-2: all-caps general officer names used as headings (after sig block starts)
  if (ALLCAPS_NAME_HEADING_RE.test(t)) return true;
  // P-2: rank title lines
  if (RANK_LINE_RE.test(t)) return true;
  // P-14: TOC heading with dotted leaders
  if (TOC_HDR_RE.test(t)) return true;
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
      const m = t.match(DATE_EXTRACT_RE);
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

  // P-2: Pre-scan to find signature block start line — everything from there to end is stripped
  let sigBlockStart = lines.length;
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 60); i--) {
    if (SIG_BLOCK_START_RE.test(lines[i].trim())) {
      sigBlockStart = i;
      break;
    }
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
    // P-2: skip signature block at end of document
    if (i >= sigBlockStart) continue;

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

    // P-1: skip garbled CP1252 / font-encoding lines
    // Backslash-sequence garbling: \DQXDU\ \6HSWHPEHU\ etc.
    if (/\\[A-Z0-9]{3,}/.test(t) && !/https?:\/\//.test(t)) {
      flushPara();
      continue;
    }
    // Control-character garbling: \x03-separated glyph sequences from bad font ToUnicode tables
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t)) {
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
      if (lvl <= 3) toc.push({ id, level: lvl, text, chap: isChapLabel });
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

    // P-2: suppress rank/name body lines that follow sig-block-like content
    if (RANK_LINE_RE.test(t)) continue;

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
