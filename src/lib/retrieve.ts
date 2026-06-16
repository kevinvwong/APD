// src/lib/retrieve.ts
// Server-side retrieval over the prebuilt section index. The JSON is loaded
// once per server instance and cached in module scope.

import fs from "fs";
import path from "path";

export interface Section {
  f: number;
  n: string;
  ft: string;
  a: string;
  h: string;
  c: string;
  b: string;
  st?: string; // source_type: "doctrine" | "book". Absent in older indexes => doctrine.
  ac?: string; // access: "public" | "private". Absent in older indexes => public.
}

let CACHE: Section[] | null = null;
function index(): Section[] {
  if (!CACHE) {
    const p = path.join(process.cwd(), "src", "data", "search-index.json");
    CACHE = JSON.parse(fs.readFileSync(p, "utf-8")) as Section[];
  }
  return CACHE;
}

const STOP = new Set(
  (
    "the a an and or of to in for on with is are be as at by from this that these those it its " +
    "what how why when where which who does do can will should would could may might army units use used using " +
    "i we you they he she them about into over under between during within without than then there here"
  ).split(" "),
);

export function terms(q: string): string[] {
  return (q.toLowerCase().match(/[a-z0-9][a-z0-9.\-]+/g) || []).filter(
    (w) => w.length >= 3 && !STOP.has(w),
  );
}

export type RetrieveScope = "all" | "doctrine" | "book";

export interface RankOpts {
  k?: number;
  restrictFm?: number | null;
  includePrivate?: boolean;
  scope?: RetrieveScope;
}

/**
 * Pure ranking over an explicit section list — the testable core of retrieve().
 * Separated from index() (which reads the on-disk JSON) so the scoring,
 * private-source gating, scope filtering, and FM restriction can be unit-tested
 * against a fixture without touching the filesystem.
 *
 * Private sources (ac === "private", e.g. copyrighted books) are excluded
 * unless `includePrivate` is true. `scope` restricts to one corpus: "doctrine"
 * (Field Manuals), "book" (reference works), or "all" (default).
 */
export function rankSections(
  ix: Section[],
  question: string,
  opts: RankOpts = {},
): Section[] {
  const { k = 8, restrictFm = null, includePrivate = false, scope = "all" } =
    opts;
  const ts = terms(question);
  if (!ts.length) return [];
  const phrase = question.trim().toLowerCase();
  const scored: { s: Section; score: number }[] = [];
  for (const s of ix) {
    if (restrictFm != null && s.f !== restrictFm) continue;
    if (!includePrivate && s.ac === "private") continue;
    // Absent st in older indexes means doctrine/FM.
    if (scope !== "all" && (s.st ?? "doctrine") !== scope) continue;
    const hLow = s.h.toLowerCase();
    const cLow = s.c ? s.c.toLowerCase() : "";
    const bLow = s.b.toLowerCase();
    let score = 0,
      headingHits = 0,
      bodyHits = 0;
    for (const t of ts) {
      const inH = hLow.includes(t) || cLow.includes(t);
      const inB = bLow.includes(t);
      if (inH) {
        score += 4;
        headingHits++;
      } else if (inB) {
        score += 1;
        bodyHits++;
      }
    }
    if (!headingHits && !bodyHits) continue;
    score += headingHits * 2.0 + bodyHits * 0.5;
    if (phrase.length > 8 && (hLow + " " + cLow + " " + bLow).includes(phrase))
      score += 8;
    scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((x) => x.s);
}

/**
 * Top-k relevant sections for a natural-language question, over the prebuilt
 * on-disk index. Thin wrapper around rankSections().
 */
export function retrieve(
  question: string,
  k = 8,
  restrictFm?: number | null,
  includePrivate = false,
  scope: RetrieveScope = "all",
): Section[] {
  return rankSections(index(), question, {
    k,
    restrictFm,
    includePrivate,
    scope,
  });
}
