// scripts/build-search-index.ts
// Builds the section-level search index from the field_manuals table.
// Run after seeding:  npx tsx scripts/build-search-index.ts
//
// Output: src/data/search-index.json  (array of sections)
//   { f: fmId, n: fmNumber, ft: fmTitle, a: anchorId, h: heading, c: crumb, b: bodyText }
//
// The anchor id (`a`) is the same heading id parseFM() assigns at read time,
// so a search result can deep-link straight to that section in the reader.

import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "../src/db/schema";
import { parseFM } from "../src/lib/fm-parse";

const db = drizzle(neon(process.env.DATABASE_URL!), {});
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const stripTags = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
   .replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\u00a0/g, " ");

interface Section { f: number; n: string; ft: string; a: string; h: string; c: string; b: string }

async function main() {
  const rows = await db
    .select({ id: fieldManuals.id, fm_number: fieldManuals.fm_number, title: fieldManuals.title, content: fieldManuals.content })
    .from(fieldManuals);

  const sections: Section[] = [];
  for (const fm of rows) {
    const doc = parseFM((fm.content || "").replace(CTRL, ""), { title: fm.title, num: fm.fm_number });
    const headIdx: Record<string, number> = {};
    doc.blocks.forEach((b, i) => { if (b.type === "h") headIdx[(b as any).id] = i; });

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
      sections.push({ f: fm.id, n: fm.fm_number, ft: fm.title, a: entry.id, h: entry.text, c: entry.level === 1 ? "" : crumb, b: body });
    }
  }

  const outDir = path.join(process.cwd(), "src", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "search-index.json");
  fs.writeFileSync(outPath, JSON.stringify(sections));
  console.log(`Wrote ${sections.length} sections -> ${outPath} (${(JSON.stringify(sections).length / 1048576).toFixed(2)} MB)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
