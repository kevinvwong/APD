// scripts/index-sections-to-db.ts
// Parses each field manual and upserts section rows into the fm_sections table,
// backing the OPTIONAL Postgres full-text retrieval path (src/lib/retrieve-pg.ts).
//
// This mirrors scripts/build-search-index.ts (same parse + section extraction),
// but writes to Postgres instead of src/data/search-index.json. The generated
// `fts` tsvector column + GIN index (created by drizzle/0000_fm_sections_fts.sql)
// are maintained by Postgres automatically on insert/update.
//
// Prereqs:  DATABASE_URL set; field_manuals seeded; migration applied.
// Run:      npm run index:db   (or: npx tsx scripts/index-sections-to-db.ts)

import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { fieldManuals, fmSections } from "../src/db/schema";
import { parseFM } from "../src/lib/fm-parse";

const db = drizzle(neon(process.env.DATABASE_URL!), {});
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/ /g, " ");

interface SectionRow {
  fm_id: number;
  anchor: string;
  heading: string;
  crumb: string;
  body: string;
  fm_number: string;
  fm_title: string;
}

async function main() {
  const rows = await db
    .select({ id: fieldManuals.id, fm_number: fieldManuals.fm_number, title: fieldManuals.title, content: fieldManuals.content })
    .from(fieldManuals);

  const sections: SectionRow[] = [];
  for (const fm of rows) {
    const doc = parseFM((fm.content || "").replace(CTRL, ""), { title: fm.title, num: fm.fm_number });
    const headIdx: Record<string, number> = {};
    doc.blocks.forEach((b, i) => { if (b.type === "h") headIdx[b.id] = i; });

    let crumb = "";
    for (let t = 0; t < doc.toc.length; t++) {
      const entry = doc.toc[t];
      const start = headIdx[entry.id];
      if (start == null) continue;
      const nextId = doc.toc[t + 1]?.id;
      const end = nextId != null && headIdx[nextId] != null ? headIdx[nextId] : doc.blocks.length;
      if (entry.level === 1) crumb = entry.text;

      const buf: string[] = [];
      for (let i = start + 1; i < end && buf.join(" ").length < 1100; i++) {
        const b = doc.blocks[i];
        if (b.type === "p" || b.type === "li") buf.push(stripTags(b.html));
        else if (b.type === "fig" && b.text) buf.push(b.text);
        else if (b.type === "tr") buf.push(b.cells.map(stripTags).join(" "));
        else if (b.type === "h") buf.push(b.text);
      }
      const body = buf.join(" ").replace(/\s+/g, " ").trim().slice(0, 1000);
      sections.push({
        fm_id: fm.id,
        anchor: entry.id,
        heading: entry.text,
        crumb: entry.level === 1 ? "" : crumb,
        body,
        fm_number: fm.fm_number,
        fm_title: fm.title,
      });
    }
  }

  // Replace this manual's rows wholesale so re-indexing stays idempotent, then
  // bulk insert. The unique (fm_id, anchor) index also guards against dupes.
  const fmIds = [...new Set(sections.map((s) => s.fm_id))];
  let inserted = 0;
  for (const fmId of fmIds) {
    await db.delete(fmSections).where(sql`${fmSections.fm_id} = ${fmId}`);
    const batch = sections.filter((s) => s.fm_id === fmId);
    // Insert in chunks to stay well under statement/param limits.
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500);
      if (chunk.length) {
        await db.insert(fmSections).values(chunk);
        inserted += chunk.length;
      }
    }
  }

  console.log(`Indexed ${inserted} sections across ${fmIds.length} manual(s) -> fm_sections`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
