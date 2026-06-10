// src/lib/retrieve.ts
// Server-side retrieval over the prebuilt section index. The JSON is loaded
// once per server instance and cached in module scope.

import fs from "fs";
import path from "path";

export interface Section { f: number; n: string; ft: string; a: string; h: string; c: string; b: string }

let CACHE: Section[] | null = null;
function index(): Section[] {
  if (!CACHE) {
    const p = path.join(process.cwd(), "src", "data", "search-index.json");
    CACHE = JSON.parse(fs.readFileSync(p, "utf-8")) as Section[];
  }
  return CACHE;
}

const STOP = new Set(
  ("the a an and or of to in for on with is are be as at by from this that these those it its "
    + "what how why when where which who does do can will should would could may might army units use used using "
    + "i we you they he she them about into over under between during within without than then there here").split(" ")
);

export function terms(q: string): string[] {
  return (q.toLowerCase().match(/[a-z0-9][a-z0-9.\-]+/g) || []).filter((w) => w.length >= 3 && !STOP.has(w));
}

/** Top-k relevant sections for a natural-language question. */
export function retrieve(question: string, k = 8, restrictFm?: number | null): Section[] {
  const ix = index();
  const ts = terms(question);
  if (!ts.length) return [];
  const phrase = question.trim().toLowerCase();
  const scored: { s: Section; score: number }[] = [];
  for (const s of ix) {
    if (restrictFm && s.f !== restrictFm) continue;
    const hay = (s.h + " " + s.c + " " + s.b).toLowerCase();
    let score = 0, hits = 0;
    for (const t of ts) {
      const inH = s.h.toLowerCase().includes(t) || (s.c && s.c.toLowerCase().includes(t));
      const inB = s.b.toLowerCase().includes(t);
      if (inH) { score += 4; hits++; } else if (inB) { score += 1; hits++; }
    }
    if (!hits) continue;
    score += hits * 1.5;
    if (phrase.length > 8 && hay.includes(phrase)) score += 8;
    scored.push({ s, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((x) => x.s);
}
