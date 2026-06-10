import path from "path";

/**
 * Extract the canonical FM number from a source filename.
 *
 * Handles the naming conventions present in `fm-md/`:
 *   ARN43326-FM_3-0-000-WEB-1  -> FM 3-0
 *   NOCASE-FM_3-07-000-WEB-0   -> FM 3-07
 *   FM 3-13 FINAL WEB          -> FM 3-13
 *   fm3_50                     -> FM 3-50
 *   fm7_100x1                  -> FM 7-100
 */
export function parseFmNumber(filename: string): string {
  const stem = path.basename(filename, ".md");

  let m: RegExpMatchArray | null;

  m = stem.match(/FM[_\s](\d+[-.]\d+(?:\.\d+)?)/i);
  if (m) return `FM ${m[1].replace(/_/g, "-")}`;

  m = stem.match(/fm(\d+)[_-](\d+)/i);
  if (m) return `FM ${m[1]}-${m[2]}`;

  return stem;
}

/**
 * Derive a human title from the manual's markdown content.
 *
 * Prefers the first non-empty line after an `# FM X-Y` heading; otherwise the
 * first H1 that looks like a real title (not just the FM number). Falls back to
 * the provided value when nothing suitable is found.
 */
export function parseTitleFromContent(content: string, fallback: string): string {
  const lines = content.split("\n");
  let foundFmHeading = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#\s+FM\s+\d/i.test(trimmed)) {
      foundFmHeading = true;
      continue;
    }
    if (foundFmHeading && trimmed && !trimmed.startsWith("#")) {
      return trimmed.replace(/\*\*/g, "");
    }
    // Also grab the first H1 that looks like a title (not just "FM X-Y")
    if (/^#\s+[A-Z]/.test(trimmed) && !/^#\s+FM\s+\d/i.test(trimmed)) {
      return trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
    }
  }
  return fallback;
}
