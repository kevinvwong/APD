// scripts/eval-retrieval.ts
// Retrieval evaluation harness. Runs the gold question set (eval/retrieval-gold
// .json) through the default JSON retrieval backend and reports recall@k, MRR,
// and section-level recall. Pure offline check over the committed search index
// — no DB, network, or LLM needed.
//
// Run:    npm run eval
// Flags:  --k <n>           top-k window (default 8)
//         --min-recall <x>  exit 1 if recall@k < x (for optional CI gating)
//
// The aim is a fast, deterministic signal on whether retrieval surfaces the
// right manual/section for known doctrinal questions — useful for catching
// regressions and comparing scoring tweaks.

import fs from "fs";
import path from "path";
import { retrieve } from "../src/lib/retrieve";
import {
  scoreCase,
  aggregate,
  type GoldCase,
  type CaseScore,
} from "../src/lib/eval-metrics";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const k = Number(flag("k") ?? 8) || 8;
  const minRecall = flag("min-recall") != null ? Number(flag("min-recall")) : null;

  const goldPath = path.join(process.cwd(), "eval", "retrieval-gold.json");
  const gold = (
    JSON.parse(fs.readFileSync(goldPath, "utf-8")) as { cases: GoldCase[] }
  ).cases;

  // Validate the gold fm_numbers exist in the index, so a typo can't silently
  // count as a miss.
  const known = new Set(retrieve("army doctrine operations", 5000).map((s) => s.n));
  const unknown = [
    ...new Set(gold.flatMap((g) => g.fms).filter((n) => !known.has(n))),
  ];
  if (unknown.length) {
    console.warn(`⚠ gold references fm_number(s) not seen in index: ${unknown.join(", ")}`);
  }

  console.log(`Retrieval eval — JSON backend, k=${k}, ${gold.length} cases\n`);
  console.log("  rank  hit  sect  case");
  console.log("  ----  ---  ----  ----");

  const scores: CaseScore[] = [];
  for (const g of gold) {
    const results = retrieve(g.q, k).map((s) => ({ n: s.n, h: s.h, b: s.b }));
    const sc = scoreCase(results, g, k);
    scores.push(sc);
    const rank = sc.rank ? String(sc.rank).padStart(4) : "   —";
    console.log(
      `  ${rank}  ${sc.hit ? " ✓ " : " ✗ "}  ${sc.sectionHit ? " ✓  " : " ·  "}  ${g.id}`,
    );
  }

  const agg = aggregate(scores);
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  console.log(
    `\n  recall@${k}: ${pct(agg.recallAtK)}   MRR: ${agg.mrr.toFixed(3)}   section-recall: ${pct(agg.sectionRecall)}`,
  );

  if (minRecall != null && agg.recallAtK < minRecall) {
    console.error(
      `\n✗ recall@${k} ${pct(agg.recallAtK)} below threshold ${pct(minRecall)}`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
