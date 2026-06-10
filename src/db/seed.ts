import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "./schema";
import { sql } from "drizzle-orm";
import { parseFmNumber, parseTitleFromContent } from "../lib/fm";
import { extractToc } from "../lib/toc";

const db = drizzle(neon(process.env.DATABASE_URL!), {});

const MD_DIR = path.join(process.cwd(), "fm-md");

async function main() {
  const files = fs.readdirSync(MD_DIR).filter(f => f.endsWith(".md"));
  console.log(`Seeding ${files.length} Field Manuals into Neon...`);

  // Clear existing rows
  await db.execute(sql`TRUNCATE field_manuals RESTART IDENTITY`);

  let inserted = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(MD_DIR, file), "utf-8");
    const fm_number = parseFmNumber(file);
    const title = parseTitleFromContent(content, fm_number);
    const char_count = content.length;
    const word_count = content.split(/\s+/).filter(Boolean).length;
    const toc = extractToc(content);

    await db.insert(fieldManuals).values({
      fm_number,
      title,
      filename: path.basename(file, ".md"),
      content,
      word_count,
      char_count,
      toc,
    });

    console.log(`  [${++inserted}/${files.length}] ${fm_number} — ${title.slice(0, 60)}`);
  }

  console.log(`\nDone. ${inserted} rows inserted.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
