// reader-parse.js — tolerant parser for the PDF-extracted FM markdown.
// Exposes window.parseFM(md) -> { meta, blocks, toc }
// - joins soft-wrapped lines into paragraphs
// - strips page furniture, dotted-leader contents/figure/table dumps
// - generates a clean table of contents from real section headings
(function () {
  "use strict";

  const MONTHS = "JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER";

  // lines that are pure page furniture / artifacts → dropped entirely
  function isFurniture(line) {
    const t = line.trim();
    if (!t) return false;
    if (/^\*+\s*\*+$/.test(t)) return true;
    if (/^\*\*[ivxlcdm\d]{1,6}\*\*$/i.test(t)) return true;                 // **iv**  **23**
    if (/^\*\*FM\s*[\dA-Z.\-]+\*\*$/i.test(t)) return true;                  // **FM 3-0**
    if (new RegExp(`^\\*\\*?\\d{1,2}\\s+(${MONTHS})\\s+\\d{4}\\*?\\*?$`, "i").test(t)) return true; // **21 March 2025**
    if (/^#+\s*This page intentionally left blank\.?$/i.test(t)) return true;
    if (/^#*\s*\*?\*?(Contents|Page)\*?\*?$/i.test(t)) return true;
    return false;
  }

  // dotted-leader entries: "### War and Warfare ....... 6"  (contents / figures / tables lists)
  function isLeaderLine(line) {
    return /\.{4,}\s*\d*\s*$/.test(line) || /\.{6,}/.test(line);
  }

  // running-header / page artifacts specific to body pages
  function isRunHeader(t) {
    return /^\*\*Chapter\s+[\dA-Z]+\*\*$/i.test(t) ||
           /^\*\*Appendix\s+[A-Z]\*\*$/i.test(t) ||
           /^\*\*[A-Z][A-Za-z].{0,40}\(INCL\s+C\d\)\*\*$/i.test(t);
  }

  // figure / table caption -> {kind,label,text}
  function figCaption(t) {
    const bare = t.replace(/\*\*/g, "").trim();
    const m = bare.match(/^(Table|Figure)\s+([A-Za-z]?-?\d+(?:[.\-]\d+)*)\.\s*(.*)$/i);
    if (!m) return null;
    return { kind: m[1].toLowerCase(), label: m[1] + " " + m[2], text: (m[3] || "").trim() };
  }
  function isNumberedPara(t) { return /^\d+[-\u2013]\d+\.\s/.test(t); }
  function isBullet(t) { return /^([-*\u2022\u2023\u25e6]|\d+[.)])\s+/.test(t); }
  function looksSentence(t) {
    const x = t.replace(/\*+/g, "").trim();
    return x.length >= 55 && /[a-z]/.test(x) && /[.:;,)]$/.test(x);
  }

  // clean a heading's text: drop leading #, dotted leaders, trailing page nums, bold/italic stars
  function cleanHeading(raw) {
    return raw
      .replace(/^#+\s*/, "")
      .replace(/\.{2,}\s*\d*\s*$/, "")
      .replace(/\*+/g, "")
      .replace(/^[\s*·•\-–—]+/, "")
      .replace(/\s+$/, "")
      .trim();
  }

  // headings we never want in the TOC even if they appear as real headings
  function isJunkHeading(t, opts) {
    if (!t) return true;
    if (/^(DISTRIBUTION RESTRICTION|HEADQUARTERS|FIELD MANUAL|No\.?\s|This publication|This page|Approved for public|Washington, DC|Send comments)/i.test(t)) return true;
    if (/https?:\/\//i.test(t) || /^\(/.test(t) || /army\.mil|train\.army/i.test(t)) return true;
    if (/^(Figures?|Tables?|Contents|Page|Index)$/i.test(t)) return true;
    if (new RegExp(`^(${MONTHS})\\s+\\d{4}$`, "i").test(t)) return true;
    if (/^FM\s*[\dA-Z.\-]+$/i.test(t)) return true;     // bare "FM 3-0"
    if (/^\*?[ivxlcdm]+\*?$/i.test(t)) return true;
    if (t.length < 2) return true;
    // drop headings that merely repeat the publication title / number
    if (opts) {
      const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (opts.title && norm(t) === norm(opts.title)) return true;
      if (opts.num && norm(t) === norm(opts.num)) return true;
    }
    return false;
  }

  // inline markdown -> safe-ish HTML (our own content)
  function inline(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^\*])\*([^\*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/\b(ADP|ADRP|FM|ATP|JP|AR|DA Form|ATTP)\s(\d[\dA-Z.\-]*)/g,
               '<span class="xref">$1&nbsp;$2</span>');
  }

  function parseFM(md, opts) {
    opts = opts || {};
    const lines = md.replace(/\r/g, "").split("\n");

    // --- meta from the head ---
    let date = "", restriction = "";
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      const t = lines[i].trim();
      if (!date) {
        const m = t.match(new RegExp(`(\\d{1,2}\\s+)?(${MONTHS})\\s+(\\d{4})`, "i"));
        if (m) date = (m[1] || "").trim() + (m[1] ? " " : "") + m[2].charAt(0) + m[2].slice(1).toLowerCase() + " " + m[3];
      }
      if (!restriction && /distribution is unlimited/i.test(t)) restriction = "Approved for public release; distribution is unlimited.";
    }

    const blocks = [];
    const toc = [];
    let para = [];
    let hid = 0;
    let debris = 0;   // >0 while skipping flattened table/figure cell fragments

    const flushPara = () => {
      if (!para.length) return;
      const text = para.join(" ").replace(/\s{2,}/g, " ").trim();
      if (text) blocks.push({ type: "p", html: inline(text) });
      para = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();

      if (!t) { flushPara(); continue; }
      if (isFurniture(raw) || isRunHeader(t)) { flushPara(); continue; }
      if (isLeaderLine(raw)) { flushPara(); continue; }   // contents/figure/table dumps

      // figure / table caption -> placeholder, then skip the flattened cell debris
      const fig = figCaption(t);
      if (fig) {
        flushPara();
        blocks.push({ type: "fig", kind: fig.kind, label: fig.label, text: fig.text });
        debris = 1;
        continue;
      }
      if (debris > 0) {
        const isHeadingLine = /^#{1,6}\s/.test(raw);
        if (isHeadingLine || isNumberedPara(t) || isBullet(t) || looksSentence(t) || debris > 90) {
          debris = 0;   // real content resumed — fall through and process this line
        } else {
          debris++; continue;   // drop cell fragment
        }
      }

      // table rows (basic)
      if (/^\|.*\|/.test(t)) {
        flushPara();
        const cells = t.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (/^[\s|:\-]+$/.test(t)) continue;              // separator row
        blocks.push({ type: "tr", cells: cells.map(inline) });
        continue;
      }

      // heading
      const hm = raw.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        flushPara();
        const level = Math.min(hm[1].length, 3);
        const text = cleanHeading(hm[2]);
        if (isJunkHeading(text, opts)) continue;
        // skip a heading identical to the previous one (de-dupe repeated fragments)
        const prevH = blocks.length && blocks[blocks.length - 1].type === "h" ? blocks[blocks.length - 1] : null;
        if (prevH && prevH.text === text) continue;
        // detect chapter / appendix labels to promote them
        const isChapLabel = /^(chapter|appendix|part)\s+[\w.\-]+$/i.test(text);
        const isChapter = isChapLabel ||
                          /^(chapter|appendix|section|part)\b/i.test(text) ||
                          /^(preface|introduction|acknowledgements?|glossary|references|index|foreword|summary of changes)$/i.test(text);
        const lvl = isChapter ? 1 : level;
        const id = "h" + (++hid);
        blocks.push({ type: "h", level: lvl, text, id, chap: isChapLabel });
        if (lvl <= 2) toc.push({ id, level: lvl, text, chap: isChapLabel });
        continue;
      }

      // list item
      if (/^([-*•‣◦]|\d+[.)])\s+/.test(t)) {
        flushPara();
        blocks.push({ type: "li", html: inline(t.replace(/^([-*•‣◦]|\d+[.)])\s+/, "")) });
        continue;
      }

      // otherwise accumulate into paragraph
      para.push(t);
    }
    flushPara();

    // merge a lone "Chapter N" TOC entry with the title that follows it
    const mergedToc = [];
    for (let i = 0; i < toc.length; i++) {
      const e = toc[i], nx = toc[i + 1];
      if (e.chap && nx && !nx.chap) {
        mergedToc.push({ id: e.id, level: 1, text: e.text + " · " + nx.text });
        i++;
      } else {
        mergedToc.push(e);
      }
    }

    return { meta: { date, restriction }, blocks, toc: mergedToc };
  }

  window.parseFM = parseFM;
})();
