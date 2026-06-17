// Fetch Renfro "Public Administration: The Essentials" from UMN Manifold.
//
// Why this exists: the publisher PDF (scholarworks.uni.edu viewcontent.cgi) is
// behind an AWS WAF JS-challenge and cannot be downloaded headlessly, and the
// only Internet Archive copies are borrow-gated scans. Manifold serves the
// born-digital reader text (cleaner than any OCR), and its JSON API is open.
//
// Strategy: API gives ordered texts + each text's section (id + textSlug). The
// readable body is server-rendered inside <div id="manifold-text-section"> at
// /read/<textSlug>/section/<sectionId>. Extract that div, convert to markdown.
//
// Usage:
//   node scripts/fetch-renfro-manifold.mjs   # writes books/renfro-public-administration-essentials.md
//   npm run books:ingest-all -- --no-fetch --only renfro-public-administration-essentials
//   npm run search:index
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const BASE = "https://manifold.open.umn.edu";
const PROJECT = "1a7e5226-a04f-4f39-b683-f54193c809d5";
const UA = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  ROOT,
  "books",
  "renfro-public-administration-essentials.md",
);

async function apiJson(path) {
  const r = await fetch(BASE + path, { headers: UA });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}
async function getHtml(path) {
  const r = await fetch(BASE + path, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.text();
}

// pull the inner HTML of <div id="manifold-text-section" ...> ... </div> (balanced)
function extractBody(html) {
  const open = html.search(/<div[^>]*id="manifold-text-section"[^>]*>/i);
  if (open < 0) return "";
  const tagEnd = html.indexOf(">", open) + 1;
  let depth = 1,
    i = tagEnd;
  const re = /<\/?div\b/gi;
  re.lastIndex = tagEnd;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].toLowerCase() === "</div") depth--;
    else depth++;
    if (depth === 0) return html.slice(tagEnd, m.index);
  }
  return html.slice(tagEnd);
}

function htmlToMd(html) {
  let s = html;
  s = s.replace(/<figure[\s\S]*?<\/figure>/gi, "");
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (t) => "\n\n" + strip(t) + "\n\n");
  s = s.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, n, t) => `\n\n${"#".repeat(+n)} ${strip(t)}\n\n`,
  );
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t)}\n`);
  s = s.replace(/<\/(p|div|section|ul|ol|blockquote|tr)>/gi, "\n\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
function strip(t) {
  return decode(t.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

async function main() {
  const pd = await apiJson(`/api/v1/projects/${PROJECT}`);
  const textRefs = pd.data.relationships.texts.data;
  console.error(`${textRefs.length} texts`);

  const parts = [`# Public Administration: The Essentials\n`];
  let totalWords = 0,
    ok = 0;
  for (const tr of textRefs) {
    const rel = await apiJson(
      `/api/v1/texts/${tr.id}/relationships/text_sections`,
    );
    for (const sec of rel.data) {
      const { textSlug, name } = sec.attributes;
      const sid = sec.id;
      try {
        const html = await getHtml(`/read/${textSlug}/section/${sid}`);
        const bodyHtml = extractBody(html);
        const md = htmlToMd(bodyHtml);
        const w = md.split(/\s+/).filter(Boolean).length;
        if (w < 50) {
          console.error(`  ! ${textSlug} only ${w} words — skipped`);
          continue;
        }
        parts.push(`\n## ${strip(name)}\n`);
        parts.push(md);
        totalWords += w;
        ok++;
        console.error(`  ✓ ${textSlug}: ${w.toLocaleString()} words`);
      } catch (e) {
        console.error(`  ✗ ${textSlug}: ${e.message}`);
      }
    }
  }

  const out = parts.join("\n") + "\n";
  fs.writeFileSync(OUT, out);
  const heads = out.split("\n").filter((l) => l.startsWith("#")).length;
  console.error(
    `\nWROTE ${OUT}\n  sections=${ok} words=${totalWords.toLocaleString()} headings=${heads} chars=${out.length.toLocaleString()}`,
  );
}
main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
