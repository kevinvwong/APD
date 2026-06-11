// scripts/reseed-garbled.ts — re-seeds FM content for re-extracted files
// Run: npx tsx scripts/reseed-garbled.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "../src/db/schema";
import { eq } from "drizzle-orm";

const db = drizzle(neon(process.env.DATABASE_URL!), {});
const MD_DIR = path.join(process.cwd(), "fm-md");

const TARGETS = [
  {
    file: "ARN31505-FM_3-96-000-WEB-1.md",
    fm_number: "FM 3-96",
    title: "Brigade Combat Team",
  },
  {
    file: "ARN38993-FM_3-27-000-WEB-1.md",
    fm_number: "FM 3-27",
    title: "Army Global Ballistic Missile Defense Operations",
  },
  {
    file: "ARN39171-FM_3-84-000-WEB-1.md",
    fm_number: "FM 3-84",
    title: "Legal Support to Operations",
  },
];

async function main() {
  for (const t of TARGETS) {
    const content = fs.readFileSync(path.join(MD_DIR, t.file), "utf-8");
    const word_count = content.split(/\s+/).filter(Boolean).length;
    const char_count = content.length;
    const [row] = await db
      .select({ id: fieldManuals.id })
      .from(fieldManuals)
      .where(eq(fieldManuals.fm_number, t.fm_number));
    if (row) {
      await db
        .update(fieldManuals)
        .set({ content, word_count, char_count, title: t.title })
        .where(eq(fieldManuals.id, row.id));
      console.log(
        `Updated ${t.fm_number} — ${word_count.toLocaleString()} words`,
      );
    } else {
      console.log(`NOT FOUND: ${t.fm_number}`);
    }
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
