// src/lib/rank-fusion.ts
// Reciprocal Rank Fusion (RRF) — combine several independently-ranked result
// lists (e.g. keyword + vector) into one. RRF is robust because it uses only
// each item's *rank* within its list, not raw scores that aren't comparable
// across very different scoring systems.
//
// score(item) = Σ over lists  1 / (rrfK + rank)      (rank is 1-based)

/** Minimal shape needed to identify a section across lists. */
export interface Rankable {
  f: number; // source id
  a: string; // section anchor
}

/**
 * Fuse ranked lists (each ordered best-first) into a single top-k list.
 * Items are identified by (f, a); the first occurrence's object is kept.
 */
export function reciprocalRankFusion<T extends Rankable>(
  lists: T[][],
  k = 8,
  rrfK = 60,
): T[] {
  const score = new Map<string, number>();
  const item = new Map<string, T>();
  for (const list of lists) {
    list.forEach((it, i) => {
      const key = `${it.f}::${it.a}`;
      score.set(key, (score.get(key) ?? 0) + 1 / (rrfK + i + 1));
      if (!item.has(key)) item.set(key, it);
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key]) => item.get(key)!);
}
