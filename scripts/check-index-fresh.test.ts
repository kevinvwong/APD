// scripts/check-index-fresh.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSearchIndex } from "./check-index-fresh";

const good = [
  { f: 1, n: "FM 3-0", ft: "Operations", a: "h1", h: "Intro", c: "", b: "body" },
];

test("a well-formed index passes", () => {
  assert.deepEqual(validateSearchIndex(good), []);
});

test("a non-array is an error", () => {
  const issues = validateSearchIndex({} as unknown);
  assert.equal(issues[0].level, "error");
  assert.match(issues[0].msg, /not a JSON array/);
});

test("an empty array is an error", () => {
  const issues = validateSearchIndex([]);
  assert.equal(issues[0].level, "error");
  assert.match(issues[0].msg, /empty/);
});

test("rows missing required fields are flagged", () => {
  const bad = [{ f: 1, n: "x" }, ...good];
  const issues = validateSearchIndex(bad);
  assert.equal(issues.length, 1);
  assert.match(issues[0].msg, /1 of 2 sections missing required fields/);
});
