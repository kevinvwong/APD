// src/lib/eval-metrics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  firstRelevantRank,
  scoreCase,
  aggregate,
  type RetrievedLite,
  type GoldCase,
} from "./eval-metrics";

const r = (n: string, h = "", b = ""): RetrievedLite => ({ n, h, b });

test("firstRelevantRank is 1-based and 0 on miss", () => {
  const list = [r("FM 3-0"), r("FM 6-0"), r("FM 5-0")];
  assert.equal(firstRelevantRank(list, ["FM 6-0"]), 2);
  assert.equal(firstRelevantRank(list, ["FM 9-9"]), 0);
});

test("scoreCase: hit + reciprocal rank", () => {
  const gold: GoldCase = { id: "x", q: "?", fms: ["FM 6-0"] };
  const s = scoreCase([r("FM 3-0"), r("FM 6-0")], gold, 8);
  assert.equal(s.hit, true);
  assert.equal(s.rank, 2);
  assert.equal(s.rr, 0.5);
});

test("scoreCase: respects k window", () => {
  const gold: GoldCase = { id: "x", q: "?", fms: ["FM 6-0"] };
  const list = [r("FM 3-0"), r("FM 5-0"), r("FM 6-0")];
  assert.equal(scoreCase(list, gold, 2).hit, false); // FM 6-0 is rank 3, outside k=2
});

test("scoreCase: keyword pins the section", () => {
  const gold: GoldCase = {
    id: "x",
    q: "?",
    fms: ["FM 6-0"],
    keywords: ["mission command"],
  };
  const good = scoreCase([r("FM 6-0", "Mission Command", "principles")], gold, 8);
  assert.equal(good.sectionHit, true);
  const wrongSection = scoreCase([r("FM 6-0", "Preface", "foreword")], gold, 8);
  assert.equal(wrongSection.hit, true); // right source
  assert.equal(wrongSection.sectionHit, false); // but no keyword match
});

test("aggregate computes means", () => {
  const scores = [
    { hit: true, rank: 1, rr: 1, sectionHit: true },
    { hit: false, rank: 0, rr: 0, sectionHit: false },
  ];
  const a = aggregate(scores);
  assert.equal(a.n, 2);
  assert.equal(a.recallAtK, 0.5);
  assert.equal(a.mrr, 0.5);
  assert.equal(a.sectionRecall, 0.5);
});
