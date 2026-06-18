/**
 * Schema drift check — compares Drizzle table declarations in src/db/schema.ts
 * against the live Postgres database's information_schema.
 *
 * Why this exists: tsc --noEmit and next build are static-only checks. They
 * never query the live DB. So if someone renames a table in the Neon console
 * (or runs a migration on prod but not in code), CI happily passes and every
 * authenticated page silently 500s in production.
 *
 * This script:
 *   - Imports every declared pgTable from src/db/schema.ts
 *   - Reads each table's declared name + columns via getTableConfig()
 *   - Queries information_schema.columns for the actual DB columns
 *   - Diffs the two and prints MISSING IN DB / MISSING IN CODE per table
 *   - Exits 1 on any drift, 0 if clean
 *
 * If DATABASE_URL is missing, exits 0 with a skipped message so contributors
 * without DB access aren't blocked locally.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  sources,
  fmSections,
  conversations,
  messages,
  userBookmarks,
  userRecents,
  userHighlights,
} from "../src/db/schema";

// Each entry is a declared Drizzle pgTable export we want to verify.
const TABLES: PgTable[] = [
  sources,
  fmSections,
  conversations,
  messages,
  userBookmarks,
  userRecents,
  userHighlights,
];

// Columns that exist in the DB by design but aren't (and can't be) declared in
// the Drizzle schema. These will be suppressed from the MISSING IN CODE diff.
// Keep this list small and document the reason for each entry.
const IGNORED_DB_ONLY_COLUMNS: Record<string, Set<string>> = {
  // fm_sections has two columns that exist in the DB by design but aren't
  // declared in schema.ts:
  //   - fts: generated tsvector column with weighted A/B/C ranking, created
  //     in drizzle/0000_fm_sections_fts.sql because drizzle-kit's
  //     IndexBuilder can't express a generated/expression tsvector column.
  //   - embedding: pgvector(1536) column added by drizzle/0002_pgvector.sql
  //     for the optional hybrid retrieval path. drizzle-orm core doesn't ship
  //     a vector column type, so it's managed as a SQL-only migration.
  fm_sections: new Set(["fts", "embedding"]),
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("Schema check: skipped — no DATABASE_URL in environment.");
    process.exit(0);
  }

  const db = drizzle(neon(dbUrl), {});

  console.log(`Schema check vs ${hostFromUrl(dbUrl)}:`);
  console.log("");

  let drifted = 0;

  for (const table of TABLES) {
    const cfg = getTableConfig(table);
    const declaredTableName = cfg.name;
    const declaredColumns = new Set(cfg.columns.map((c) => c.name));

    // information_schema.columns gives us the live DB's view of this table.
    const rows = (await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${declaredTableName}`,
    )) as unknown as
      | { rows?: Array<{ column_name: string }> }
      | Array<{ column_name: string }>;

    // neon-http returns either { rows: [...] } or [...] depending on driver
    // shape; normalize.
    const rowArr: Array<{ column_name: string }> = Array.isArray(rows)
      ? rows
      : (rows.rows ?? []);
    const actualColumns = new Set(rowArr.map((r) => r.column_name));

    if (actualColumns.size === 0) {
      console.log(`  [DRIFT] ${declaredTableName}: table not found in DB`);
      console.log(`    declared columns: ${[...declaredColumns].join(", ")}`);
      drifted++;
      continue;
    }

    const missingInDb: string[] = [];
    for (const col of declaredColumns) {
      if (!actualColumns.has(col)) missingInDb.push(col);
    }
    const ignored = IGNORED_DB_ONLY_COLUMNS[declaredTableName] ?? new Set();
    const missingInCode: string[] = [];
    for (const col of actualColumns) {
      if (!declaredColumns.has(col) && !ignored.has(col)) {
        missingInCode.push(col);
      }
    }

    if (missingInDb.length === 0 && missingInCode.length === 0) {
      console.log(
        `  [OK]    ${declaredTableName} (${actualColumns.size} columns)`,
      );
    } else {
      console.log(`  [DRIFT] ${declaredTableName}`);
      if (missingInDb.length > 0) {
        console.log(`    MISSING IN DB:   ${missingInDb.join(", ")}`);
      }
      if (missingInCode.length > 0) {
        console.log(`    MISSING IN CODE: ${missingInCode.join(", ")}`);
      }
      drifted++;
    }
  }

  console.log("");
  if (drifted > 0) {
    console.log(`Schema check FAILED — ${drifted} table(s) drifted.`);
    process.exit(1);
  } else {
    console.log(`Schema check passed — ${TABLES.length} table(s) match.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Schema check errored:", err);
  process.exit(1);
});
