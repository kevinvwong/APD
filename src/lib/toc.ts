import GithubSlugger from "github-slugger";

export type TocEntry = { depth: 1 | 2 | 3; text: string; slug: string };

// Headings that are front-matter boilerplate rather than navigable content.
// Field manuals open with the FM number, publication month/year, distribution
// statement, headquarters block, PIN, and stray URLs as headings.
const NOISE_PATTERNS: RegExp[] = [
  /^FM\s+\d/i, // the FM number heading
  /^[A-Z][a-z]+\s+\d{4}$/, // "September 2014"
  /^[A-Z]+\s+\d{4}$/, // "SEPTEMBER 2014"
  /^\d{1,2}\s+[A-Z][a-z]+\s+\d{4}$/, // "2 September 2014"
  /^HEADQUARTERS\b/i,
  /^DISTRIBUTION\s+RESTRICTION/i,
  /^DISTRIBUTION\s+STATEMENT/i,
  /^PIN[:\s]/i,
  /^https?:\/\//i,
  /^Washington,?\s+DC/i,
];

/** Strip inline markdown so heading text matches what rehype-slug sees. */
function cleanHeadingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\*\*([^*]*)\*\*/g, "$1") // bold
    .replace(/\*([^*]*)\*/g, "$1") // italic
    .replace(/__([^_]*)__/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(text));
}

/**
 * Extract an H1–H3 table of contents from manual markdown. Slugs are generated
 * with github-slugger (same algorithm and stateful duplicate-numbering as
 * rehype-slug), in document order, so the TOC anchors match the ids rehype
 * emits at render time. Fenced code blocks are skipped.
 */
export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const entries: TocEntry[] = [];
  let inFence = false;

  for (const line of markdown.split("\n")) {
    const fence = line.trimStart().match(/^(```|~~~)/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,3})\s+(.*\S)\s*#*\s*$/);
    if (!m) continue;

    const depth = m[1].length as 1 | 2 | 3;
    const text = cleanHeadingText(m[2]);
    if (!text || isNoise(text)) continue;

    // Consume a slug even if we end up dropping the entry, so the stateful
    // duplicate-numbering stays aligned with rehype-slug (which slugs this
    // heading too). Skip headings whose text has no sluggable characters
    // (e.g. a lone "→") — rehype emits no usable id for them either.
    const slug = slugger.slug(text);
    if (!slug) continue;
    entries.push({ depth, text, slug });
  }

  return entries;
}
