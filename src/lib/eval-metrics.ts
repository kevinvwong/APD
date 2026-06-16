// src/lib/eval-metrics.ts
// Pure scoring for the retrieval evaluation harness (scripts/eval-retrieval.ts).
// Kept separate from the harness so the metric math is unit-tested.

/** One labeled question: which source(s) should be retrieved, with optional
 *  keywords that pin down the right section within that source. */
export interface GoldCase {
  id: string;
  q: string;
  fms: string[]; // acceptable fm_number(s), e.g. ["FM 6-0"]
  keywords?: string[]; // optional: section heading/body should contain one of these
}

/** Minimal shape of a retrieved section needed for scoring. */
export interface RetrievedLite {
  n: string; // fm_number
  h: string; // heading
  b: string; // body
}

/** 1-based rank of the first section whose source is in `fms`, or 0 if none. */
export function firstRelevantRank(
  retrieved: RetrievedLite[],
  fms: string[],
): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (fms.includes(retrieved[i].n)) return i + 1;
  }
  return 0;
}

export interface CaseScore {
  hit: boolean; // a correct-source section appears in top-k
  rank: number; // rank of first correct-source section (0 = miss)
  rr: number; // reciprocal rank (0 on miss)
  sectionHit: boolean; // correct source AND a keyword match (falls back to hit)
}

export function scoreCase(
  retrieved: RetrievedLite[],
  gold: GoldCase,
  k: number,
): CaseScore {
  const top = retrieved.slice(0, k);
  const rank = firstRelevantRank(top, gold.fms);
  const hit = rank > 0;
  const rr = rank > 0 ? 1 / rank : 0;
  const kws = gold.keywords ?? [];
  const sectionHit = kws.length
    ? top.some(
        (s) =>
          gold.fms.includes(s.n) &&
          kws.some((kw) =>
            (s.h + " " + s.b).toLowerCase().includes(kw.toLowerCase()),
          ),
      )
    : hit;
  return { hit, rank, rr, sectionHit };
}

export interface Aggregate {
  n: number;
  recallAtK: number; // share of questions with a correct-source hit in top-k
  mrr: number; // mean reciprocal rank
  sectionRecall: number; // share with a correct-source + keyword match
}

export function aggregate(scores: CaseScore[]): Aggregate {
  const n = scores.length;
  const d = n || 1;
  return {
    n,
    recallAtK: scores.filter((s) => s.hit).length / d,
    mrr: scores.reduce((a, s) => a + s.rr, 0) / d,
    sectionRecall: scores.filter((s) => s.sectionHit).length / d,
  };
}
