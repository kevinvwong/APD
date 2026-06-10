/** Human-readable topic labels for the FM series (the digit before the dash). */
export const SERIES_LABELS: Record<string, string> = {
  "1": "The Army & Personnel",
  "2": "Intelligence",
  "3": "Operations & Tactics",
  "4": "Sustainment",
  "5": "Planning & Engineering",
  "6": "Command, Control & Signal",
  "7": "Training & Leader Development",
};

export function seriesLabel(series: string): string {
  return SERIES_LABELS[series] ?? `FM ${series} Series`;
}

/** Derive the series key from an FM number: "FM 3-50" -> "3", "FM 1-02.2" -> "1". */
export function deriveSeries(fmNumber: string): string {
  const m = fmNumber.match(/^FM\s+(\d+)/i);
  return m ? m[1] : "?";
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Best-effort publication date from the manual's front matter, returned as an
 * ISO `YYYY-MM-DD` string (day defaults to 01 when only month/year is given).
 * Scans the top of the document for "DD Month YYYY" or "Month YYYY". Returns
 * null when nothing is found — never throws.
 */
export function parsePublicationDate(content: string): string | null {
  const head = content.split("\n").slice(0, 200).join("\n");
  const re = new RegExp(
    `\\b(?:(\\d{1,2})\\s+)?(${MONTHS.join("|")})\\s+(\\d{4})\\b`,
    "i"
  );
  const m = head.match(re);
  if (!m) return null;
  const day = m[1] ? Number(m[1]) : 1;
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const year = Number(m[3]);
  if (year < 1900 || year > 2100 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Count distinct chapters by scanning heading lines for "Chapter N". */
export function countChapters(content: string): number {
  const chapters = new Set<number>();
  for (const line of content.split("\n")) {
    const m = line.match(/^#{1,6}\s*chapter\s+(\d+)\b/i);
    if (m) chapters.add(Number(m[1]));
  }
  return chapters.size;
}
