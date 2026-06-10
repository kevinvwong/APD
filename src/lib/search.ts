import { sql, type SQL } from "drizzle-orm";

// Rare sentinel markers for ts_headline. ts_headline does NOT HTML-escape the
// surrounding document (which is raw markdown containing <, &, *), so we cannot
// let it emit <mark> directly. Instead it wraps matches in these non-HTML
// sentinels; we escape the whole fragment server-side, then swap the sentinels
// for real <mark> tags. See headlineToHtml below.
const START = "⟦⟦"; // ⟦⟦
const STOP = "⟧⟧"; // ⟧⟧

const HEADLINE_OPTS =
  `StartSel=${START},StopSel=${STOP},MaxFragments=2,MaxWords=40,MinWords=18,FragmentDelimiter= … `;

/** websearch_to_tsquery gives free phrase ("..."), OR, and -negation support. */
function tsquery(q: string): SQL {
  return sql`websearch_to_tsquery('english', ${q})`;
}

/**
 * WHERE fragment for full-text search. Matches against the weighted
 * `search_tsv` generated column. For inputs that reduce to an empty tsquery
 * (single characters, all-stopword queries), falls back to ILIKE on the
 * metadata columns so the user still gets sensible results.
 */
export function ftsWhere(q: string): SQL {
  const tq = tsquery(q);
  const like = `%${q}%`;
  return sql`(
    search_tsv @@ ${tq}
    OR (
      numnode(${tq}) = 0
      AND (fm_number ILIKE ${like} OR title ILIKE ${like} OR filename ILIKE ${like})
    )
  )`;
}

/** Relevance score; title/number matches outrank body matches via setweight. */
export function ftsRank(q: string): SQL<number> {
  return sql<number>`ts_rank(search_tsv, ${tsquery(q)})`;
}

/** Highlighted excerpt with sentinel markers around matched lexemes. */
export function ftsHeadline(q: string): SQL<string> {
  return sql<string>`ts_headline('english', content, ${tsquery(q)}, ${HEADLINE_OPTS})`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Convert a ts_headline result into safe HTML: escape every HTML metacharacter
 * in the (untrusted, raw-markdown) text, then replace the sentinels with
 * <mark>. Returns `{ html, hasMatch }`; `hasMatch` is false when ts_headline
 * found nothing to highlight (e.g. a metadata-only match), which the UI uses to
 * decide whether to show a body excerpt at all.
 */
export function headlineToHtml(headline: string): { html: string; hasMatch: boolean } {
  const hasMatch = headline.includes(START);
  const escaped = headline.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  const html = escaped.split(START).join("<mark>").split(STOP).join("</mark>");
  return { html, hasMatch };
}
