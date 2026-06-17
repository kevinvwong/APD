// src/lib/retrieve-hybrid.ts
// OPTIONAL hybrid retrieval — fuses the Postgres keyword (tsvector) path with
// semantic vector search (pgvector), combining them via Reciprocal Rank Fusion.
// Same (question, k, restrictFm, includePrivate, scope) -> Section[] contract as
// the other backends, so the API route can select it with RETRIEVE_BACKEND=hybrid.
//
// Requires: the pgvector migration (drizzle/0002_pgvector.sql) applied, the
// fm_sections.embedding column populated (scripts/embed-sections.ts), and an
// embeddings provider key (see src/lib/embed.ts). If the query can't be embedded
// (e.g. missing key), it degrades gracefully to keyword-only results.
//
// NOTE: not exercised against a live DB / embeddings API in this worktree.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Section } from "./retrieve";
import { retrieve as retrieveKeyword } from "./retrieve-pg";
import { reciprocalRankFusion } from "./rank-fusion";
import { embedOne } from "./embed";

type Scope = "all" | "doctrine" | "book";

interface SectionRow extends Record<string, unknown> {
  f: number;
  n: string;
  ft: string;
  a: string;
  h: string;
  c: string;
  b: string;
  st: string;
  ac: string;
}

async function vectorRanked(
  question: string,
  k: number,
  restrictFm: number | null | undefined,
  includePrivate: boolean,
  scope: Scope,
): Promise<Section[]> {
  let queryVec: number[];
  try {
    queryVec = await embedOne(question);
  } catch {
    // No embeddings available — let the keyword path carry the result.
    return [];
  }
  if (!queryVec?.length) return [];
  // Guard against NaN/Infinity in the embedding before interpolating into
  // SQL — pgvector rejects them, and JS's `[NaN].toString()` silently
  // produces `[NaN]` which fails at parse time with an opaque error.
  // The caller (/api/ask) catches this and falls back to JSON retrieval.
  if (queryVec.some((v) => !Number.isFinite(v))) {
    throw new Error("Embedding contains non-finite values");
  }
  const vecLiteral = `[${queryVec.join(",")}]`;

  const fmFilter = restrictFm != null ? sql`AND fm_id = ${restrictFm}` : sql``;
  const accessFilter = includePrivate ? sql`` : sql`AND access = 'public'`;
  const scopeFilter = scope === "all" ? sql`` : sql`AND source_type = ${scope}`;

  const rows = await db.execute<SectionRow>(sql`
    SELECT
      fm_id        AS f,
      fm_number    AS n,
      fm_title     AS ft,
      anchor       AS a,
      heading      AS h,
      crumb        AS c,
      body         AS b,
      source_type  AS st,
      access       AS ac
    FROM fm_sections
    WHERE embedding IS NOT NULL
    ${fmFilter}
    ${accessFilter}
    ${scopeFilter}
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT ${k}
  `);

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
    st: r.st ?? "doctrine",
    ac: r.ac ?? "public",
  }));
}

/**
 * Top-k sections fusing keyword + vector signals. Each signal contributes a
 * wider candidate pool, fused down to k via RRF.
 */
export async function retrieve(
  question: string,
  k = 8,
  restrictFm?: number | null,
  includePrivate = false,
  scope: Scope = "all",
): Promise<Section[]> {
  const q = question.trim();
  if (!q) return [];

  const pool = Math.max(k * 4, 24);
  const [keyword, vector] = await Promise.all([
    retrieveKeyword(q, pool, restrictFm, includePrivate, scope),
    vectorRanked(q, pool, restrictFm, includePrivate, scope),
  ]);

  // If vectors aren't available, this is just the keyword list (trimmed to k).
  if (!vector.length) return keyword.slice(0, k);
  return reciprocalRankFusion<Section>([keyword, vector], k);
}
