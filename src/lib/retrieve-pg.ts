// src/lib/retrieve-pg.ts
// OPTIONAL Postgres full-text retrieval path — an ADDITIVE alternative to the
// JSON-file retrieval in src/lib/retrieve.ts. Same inputs, same `Section`
// output shape, so the API route can swap backends behind an env flag
// (RETRIEVE_BACKEND=pg) without any other changes.
//
// Backed by the fm_sections table + tsvector GIN index created in
// drizzle/0000_fm_sections_fts.sql and populated by
// scripts/index-sections-to-db.ts.
//
// NOTE: This query path has NOT been run against a live database in this
// worktree — end-to-end validation requires DATABASE_URL + the applied
// migration + a populated fm_sections table.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Section } from "./retrieve";

export type { Section };

interface SectionRow extends Record<string, unknown> {
  f: number;
  n: string;
  ft: string;
  a: string;
  h: string;
  c: string;
  b: string;
}

/**
 * Top-k relevant sections for a natural-language question, using Postgres
 * full-text search (websearch_to_tsquery + ts_rank over the weighted `fts`
 * column). Mirrors retrieve() from src/lib/retrieve.ts:
 *   - same signature (question, k, restrictFm)
 *   - same Section output shape
 *   - heading/crumb weighted above body (via the A/B/C weights baked into `fts`)
 */
export async function retrieve(
  question: string,
  k = 8,
  restrictFm?: number | null,
): Promise<Section[]> {
  const q = question.trim();
  if (!q) return [];

  // websearch_to_tsquery is forgiving of free-form input (won't throw on
  // punctuation/operators the way plain to_tsquery does), matching the
  // tolerant behaviour of the JSON path.
  const tsquery = sql`websearch_to_tsquery('english', ${q})`;

  // Optional FM restriction mirrors the `restrictFm` filter in retrieve().
  const fmFilter =
    restrictFm != null ? sql`AND fm_id = ${restrictFm}` : sql``;

  const rows = await db.execute<SectionRow>(sql`
    SELECT
      fm_id      AS f,
      fm_number  AS n,
      fm_title   AS ft,
      anchor     AS a,
      heading    AS h,
      crumb      AS c,
      body       AS b
    FROM fm_sections
    WHERE fts @@ ${tsquery}
    ${fmFilter}
    ORDER BY ts_rank(fts, ${tsquery}) DESC
    LIMIT ${k}
  `);

  // neon-http returns { rows } for raw execute; normalize to the array form.
  const list: SectionRow[] = Array.isArray(rows)
    ? (rows as SectionRow[])
    : ((rows as { rows?: SectionRow[] }).rows ?? []);

  return list.map((r) => ({
    f: Number(r.f),
    n: r.n,
    ft: r.ft,
    a: r.a,
    h: r.h,
    c: r.c ?? "",
    b: r.b ?? "",
  }));
}
