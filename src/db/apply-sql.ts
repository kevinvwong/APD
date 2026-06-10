import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";

/**
 * Applies the hand-written SQL migrations in `drizzle/sql/` that drizzle-kit
 * can't express (generated columns, GIN/HNSW indexes, extensions). Each file is
 * written to be idempotent (IF NOT EXISTS), so this is safe to re-run.
 */
const db = drizzle(neon(process.env.DATABASE_URL!));
const DIR = path.join(process.cwd(), "drizzle", "sql");

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DIR, file), "utf-8");
    // Strip line comments, then split into statements on terminating semicolons.
    const stmts = raw
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of stmts) {
      await db.execute(sql.raw(stmt));
    }
    console.log(`applied ${file} (${stmts.length} statements)`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
