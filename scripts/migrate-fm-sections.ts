// scripts/migrate-fm-sections.ts
// Creates the fm_sections table + fts column + GIN index in Neon.
// Uses DATABASE_URL_UNPOOLED for DDL (the pooled URL doesn't support it).
// Run: npx tsx scripts/migrate-fm-sections.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
const sql = neon(url);

async function main() {
  console.log("Creating fm_sections table...");
  await sql`
    CREATE TABLE IF NOT EXISTS fm_sections (
      id          serial PRIMARY KEY,
      fm_id       integer NOT NULL REFERENCES field_manuals(id) ON DELETE CASCADE,
      anchor      text NOT NULL,
      heading     text NOT NULL,
      crumb       text NOT NULL DEFAULT '',
      body        text NOT NULL DEFAULT '',
      fm_number   text NOT NULL,
      fm_title    text NOT NULL,
      created_at  timestamp DEFAULT now() NOT NULL,
      CONSTRAINT fm_sections_fm_id_anchor_uq UNIQUE (fm_id, anchor)
    )
  `;
  console.log("Table OK. Adding fts column...");

  await sql`
    ALTER TABLE fm_sections
      ADD COLUMN IF NOT EXISTS fts tsvector
        GENERATED ALWAYS AS (
          setweight(to_tsvector('english', coalesce(heading, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(crumb,   '')), 'B') ||
          setweight(to_tsvector('english', coalesce(body,    '')), 'C')
        ) STORED
  `;
  console.log("fts column OK. Creating GIN index...");

  await sql`
    CREATE INDEX IF NOT EXISTS fm_sections_fts_gin
      ON fm_sections USING gin (fts)
  `;
  console.log("GIN index OK.");

  const [{ count }] = await sql`SELECT count(*) FROM fm_sections`;
  console.log(`fm_sections ready — ${count} rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
