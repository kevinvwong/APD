import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "./schema";
import { sql } from "drizzle-orm";

const db = drizzle(neon(process.env.DATABASE_URL!), {});

const MD_DIR = path.join(process.cwd(), "fm-md");

function parseFmNumber(filename: string): string {
  // Extract FM number from filename patterns like:
  // ARN43326-FM_3-0-000-WEB-1  -> FM 3-0
  // NOCASE-FM_3-07-000-WEB-0   -> FM 3-07
  // FM 3-13 FINAL WEB          -> FM 3-13
  // fm3_50                     -> FM 3-50
  // fm7_100x1                  -> FM 7-100.1
  const stem = path.basename(filename, ".md");

  let m: RegExpMatchArray | null;

  m = stem.match(/FM[_\s](\d+[-\.]\d+(?:\.\d+)?)/i);
  if (m) return `FM ${m[1].replace(/_/g, "-")}`;

  m = stem.match(/fm(\d+)[_-](\d+)/i);
  if (m) return `FM ${m[1]}-${m[2]}`;

  return stem;
}

function parseTitleFromContent(content: string, fallback: string): string {
  // Look for the first non-empty line after an H1 "# FM X-Y" heading
  const lines = content.split("\n");
  let foundFmHeading = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#\s+FM\s+\d/i.test(trimmed)) { foundFmHeading = true; continue; }
    if (foundFmHeading && trimmed && !trimmed.startsWith("#")) return trimmed.replace(/\*\*/g, "");
    // Also grab the first H1 that looks like a title (not just "FM X-Y")
    if (/^#\s+[A-Z]/.test(trimmed) && !/^#\s+FM\s+\d/i.test(trimmed)) {
      return trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, "");
    }
  }
  return fallback;
}

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

    await db.insert(fieldManuals).values({
      fm_number,
      title,
      filename: path.basename(file, ".md"),
      content,
      word_count,
      char_count,
    });

    console.log(`  [${++inserted}/${files.length}] ${fm_number} — ${title.slice(0, 60)}`);
  }

  console.log(`\nDone. ${inserted} rows inserted.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
