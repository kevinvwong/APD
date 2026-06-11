// scripts/fix-titles.ts
// Corrects FM titles that were parsed incorrectly from markdown artifacts.
// Run: npx tsx scripts/fix-titles.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { fieldManuals } from "../src/db/schema";
import { eq } from "drizzle-orm";

const db = drizzle(neon(process.env.DATABASE_URL!), {});

const CORRECTIONS: Record<string, string> = {
  "FM 1-000": "The Army",
  "FM 3-01": "U.S. Army Air and Missile Defense Operations",
  "FM 3-01.44": "Short-Range Air Defense in Army Operations",
  "FM 3-04": "Army Aviation",
  "FM 3-05": "Army Special Operations Forces",
  "FM 3-07": "Stability",
  "FM 3-08": "Casualty Evacuation",
  "FM 3-09": "Fire Support and Field Artillery Operations",
  "FM 3-11": "Chemical, Biological, Radiological, and Nuclear Operations",
  "FM 3-12": "Cyberspace and Electronic Warfare Operations",
  "FM 3-13": "Information Operations",
  "FM 3-13.4": "Army Support to Military Deception",
  "FM 3-14": "Army Space Operations",
  "FM 3-16": "The Army in Multinational Operations",
  "FM 3-22": "Army Support to Security Cooperation",
  "FM 3-24": "Counterinsurgency",
  "FM 3-27": "Army Global Ballistic Missile Defense Operations",
  "FM 3-34": "Engineer Operations",
  "FM 3-50": "Army Personnel Recovery",
  "FM 3-52": "Airspace Control",
  "FM 3-55": "Information Collection",
  "FM 3-57": "Civil Affairs Operations",
  "FM 3-61": "Communication Strategy and Digital Engagement",
  "FM 3-81": "Maneuver Enhancement Brigade",
  "FM 3-83": "Religious Affairs in Army Operations",
  "FM 3-84": "Legal Support to Operations",
  "FM 3-90": "Tactics",
  "FM 3-94": "Armies, Corps, and Division Operations",
  "FM 3-96": "Brigade Combat Team",
  "FM 3-99": "Airborne and Air Assault Operations",
  "FM 4-1": "Human Resources Support",
  "FM 6-0": "Commander and Staff Organization and Operations",
  "FM 6-02": "Signal Support to Operations",
  "FM 6-22": "Leader Development",
  "FM 6-27": "The Commander's Handbook on the Law of Land Warfare",
};

async function main() {
  const rows = await db
    .select({
      id: fieldManuals.id,
      fm_number: fieldManuals.fm_number,
      title: fieldManuals.title,
    })
    .from(fieldManuals);

  let fixed = 0;
  for (const row of rows) {
    const correct = CORRECTIONS[row.fm_number];
    if (correct && correct !== row.title) {
      await db
        .update(fieldManuals)
        .set({ title: correct })
        .where(eq(fieldManuals.id, row.id));
      console.log(`  ${row.fm_number}: "${row.title}" → "${correct}"`);
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
