// src/lib/retrieve.test.ts
// Unit tests for the pure ranking core (rankSections) — scope filtering,
// private-source gating, FM restriction, heading-over-body scoring, and the
// stopword/empty-query guard. Runs against a fixture, no filesystem needed.
//
// Run:  npm test   (tsx --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSections, terms, type Section } from "./retrieve";

const FIX: Section[] = [
  { f: 1, n: "FM 6-0", ft: "Commander and Staff", a: "h1", h: "Mission Command", c: "", b: "the principles of mission command guide leaders", st: "doctrine", ac: "public" },
  { f: 2, n: "FM 3-90", ft: "Offense and Defense", a: "h2", h: "The Defense", c: "", b: "an area defense is organized in depth", st: "doctrine", ac: "public" },
  { f: 3, n: "Taylor 1911", ft: "Scientific Management", a: "h3", h: "Scientific Management", c: "", b: "systematic soldiering and task allocation", st: "book", ac: "public" },
  { f: 4, n: "Bolman & Deal", ft: "Reframing Organizations", a: "h4", h: "Structural Frame", c: "", b: "bureaucracy authority and organizational design", st: "book", ac: "private" },
  { f: 5, n: "FM 3-07", ft: "Stability", a: "h5", h: "Stability Tasks", c: "", b: "defense support to civil authorities", st: "doctrine", ac: "public" },
];

const Q = "management command defense bureaucracy";

test("scope 'doctrine' excludes book sources", () => {
  const r = rankSections(FIX, Q, { scope: "doctrine", includePrivate: true });
  assert.ok(r.length > 0);
  assert.ok(r.every((s) => (s.st ?? "doctrine") === "doctrine"));
  assert.ok(!r.some((s) => s.f === 3 || s.f === 4));
});

test("scope 'book' returns only book sources", () => {
  const r = rankSections(FIX, Q, { scope: "book", includePrivate: true });
  assert.ok(r.length > 0);
  assert.ok(r.every((s) => s.st === "book"));
});

test("private sources gated unless includePrivate", () => {
  const gated = rankSections(FIX, Q, { scope: "book", includePrivate: false });
  assert.ok(gated.every((s) => s.ac !== "private"));
  assert.ok(!gated.some((s) => s.f === 4));

  const open = rankSections(FIX, Q, { scope: "book", includePrivate: true });
  assert.ok(open.some((s) => s.f === 4));
});

test("restrictFm narrows to a single source", () => {
  const r = rankSections(FIX, "defense area organized", { restrictFm: 2 });
  assert.ok(r.length > 0);
  assert.ok(r.every((s) => s.f === 2));
});

test("heading hits outrank body-only hits", () => {
  // 'defense' is in section 2's heading and section 5's body only.
  const r = rankSections(FIX, "defense", {});
  assert.equal(r[0].f, 2);
  assert.ok(r.some((s) => s.f === 5));
});

test("empty / all-stopword query returns nothing", () => {
  assert.deepEqual(rankSections(FIX, "the and of to", {}), []);
  assert.deepEqual(terms("the and of to"), []);
});

test("k limits the number of results", () => {
  const r = rankSections(FIX, Q, { k: 1, includePrivate: true });
  assert.equal(r.length, 1);
});
