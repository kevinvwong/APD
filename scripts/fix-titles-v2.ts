// scripts/fix-titles-v2.ts — fix truncated titles and normalize all-caps
// Run: npx tsx scripts/fix-titles-v2.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "../src/db/schema";
import { eq } from "drizzle-orm";

const db = drizzle(neon(process.env.DATABASE_URL!), {});

const FIXES: [string, string][] = [
  // Previously truncated
  ["FM 3-98", "Reconnaissance and Security Operations"],
  ["FM 6-99", "U.S. Army Report and Message Formats"],
  ["FM 5-0", "Planning and Orders Production"],
  // Normalize all-caps raw PDF extraction artifacts to proper title case
  ["FM 2-0", "Intelligence"],
  ["FM 3-0", "Operations"],
  ["FM 4-0", "Sustainment"],
  ["FM 7-22", "Holistic Health and Fitness"],
  ["FM 1-02.1", "Operational Terms"],
  ["FM 1-02.2", "Military Symbols"],
  ["FM 2-22.3", "Human Intelligence Collector Operations"],
  ["FM 3-39", "Military Police Operations"],
  ["FM 3-04", "Army Aviation"],
  ["FM 3-08", "Casualty Evacuation"],
  ["FM 3-13", "Information Operations"],
  ["FM 3-55", "Information Collection"],
  ["FM 3-60", "Army Targeting"],
  ["FM 3-61", "Communication Strategy and Digital Engagement"],
  ["FM 3-81", "Maneuver Enhancement Brigade"],
  ["FM 3-83", "Religious Affairs in Army Operations"],
  ["FM 3-84", "Legal Support to Operations"],
  ["FM 3-90", "Tactics"],
  ["FM 4-1", "Human Resources Support"],
  ["FM 4-80", "Financial Management Operations"],
  ["FM 6-02", "Signal Support to Operations"],
  ["FM 7-0", "Training"],
  ["FM 7-100", "Opposing Force"],
];

async function main() {
  let fixed = 0;
  for (const [num, title] of FIXES) {
    const [row] = await db
      .select({ id: fieldManuals.id, title: fieldManuals.title })
      .from(fieldManuals)
      .where(eq(fieldManuals.fm_number, num));
    if (row && row.title !== title) {
      await db
        .update(fieldManuals)
        .set({ title })
        .where(eq(fieldManuals.id, row.id));
      console.log(`  ${num}: "${row.title}" → "${title}"`);
      fixed++;
    }
  }
  console.log(`\nFixed ${fixed} titles.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
