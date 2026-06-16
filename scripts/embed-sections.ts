// scripts/embed-sections.ts
// Populate fm_sections.embedding for the OPTIONAL hybrid retrieval path.
// Embeds each section's (heading + body) and stores the vector. Idempotent:
// only rows with a NULL embedding are processed, so it resumes if re-run.
//
// Prereqs:
//   - drizzle/0002_pgvector.sql applied (embedding column + index)
//   - fm_sections populated (npm run index:db)
//   - an embeddings provider key (OPENAI_API_KEY or, with EMBED_PROVIDER=voyage,
//     VOYAGE_API_KEY) — see src/lib/embed.ts
//
// Run:  npx tsx scripts/embed-sections.ts
//
// NOTE: not exercised in this worktree (needs a live DB + embeddings API).

import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { embed } from "../src/lib/embed";

const db = drizzle(neon(process.env.DATABASE_URL!), {});
const BATCH = 64; // sections per embeddings request
const MAX_CHARS = 8000; // cap per section to stay within model context

interface Row extends Record<string, unknown> {
  id: number;
  heading: string;
  body: string;
}

async function main() {
  let total = 0;
  for (;;) {
    const res = await db.execute<Row>(sql`
      SELECT id, heading, body
      FROM fm_sections
      WHERE embedding IS NULL
      ORDER BY id
      LIMIT ${BATCH}
    `);
    const rows: Row[] = Array.isArray(res)
      ? (res as Row[])
      : ((res as { rows?: Row[] }).rows ?? []);
    if (!rows.length) break;

    const inputs = rows.map((r) =>
      `${r.heading}\n${r.body}`.slice(0, MAX_CHARS),
    );
    const vectors = await embed(inputs);

    // Update each row with its vector. neon-http has no multi-row VALUES helper
    // here, so update per row — batches are small.
    for (let i = 0; i < rows.length; i++) {
      const literal = `[${vectors[i].join(",")}]`;
      await db.execute(sql`
        UPDATE fm_sections
        SET embedding = ${literal}::vector
        WHERE id = ${rows[i].id}
      `);
    }

    total += rows.length;
    console.log(`  embedded ${total} sections…`);
  }

  console.log(`\nDone. Embedded ${total} section(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
