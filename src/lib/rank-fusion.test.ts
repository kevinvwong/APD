// src/lib/rank-fusion.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { reciprocalRankFusion, type Rankable } from "./rank-fusion";

const s = (f: number, a: string): Rankable => ({ f, a });

test("an item ranked highly in both lists wins", () => {
  const kw = [s(1, "a"), s(2, "b"), s(3, "c")];
  const vec = [s(1, "a"), s(4, "d"), s(2, "b")];
  const out = reciprocalRankFusion([kw, vec], 3);
  assert.equal(out[0].f, 1); // top of both lists
  // 2:b appears in both lists, so it outranks the single-list items; 4:d
  // (rank 2 in vec) then beats 3:c (rank 3 in kw).
  assert.deepEqual(
    out.map((x) => `${x.f}:${x.a}`),
    ["1:a", "2:b", "4:d"],
  );
});

test("dedupes by (f,a) across lists", () => {
  const out = reciprocalRankFusion([[s(1, "a")], [s(1, "a")]], 8);
  assert.equal(out.length, 1);
  assert.equal(out[0].f, 1);
});

test("k limits the fused output", () => {
  const list = [s(1, "a"), s(2, "b"), s(3, "c"), s(4, "d")];
  assert.equal(reciprocalRankFusion([list], 2).length, 2);
});

test("a higher rank contributes a larger score than a lower rank", () => {
  // item X is rank 1 in list A only; item Y is rank 3 in list A only.
  const a = [s(1, "x"), s(9, "z"), s(2, "y")];
  const out = reciprocalRankFusion([a], 3);
  assert.equal(out[0].f, 1);
  assert.equal(out[out.length - 1].f, 2);
});

test("empty lists yield an empty result", () => {
  assert.deepEqual(reciprocalRankFusion<Rankable>([], 8), []);
  assert.deepEqual(reciprocalRankFusion<Rankable>([[], []], 8), []);
});
