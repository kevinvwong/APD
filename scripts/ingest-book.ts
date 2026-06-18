// scripts/ingest-book.ts
// Ingest a single curated reference work (a "book" source) into the `sources`
// table, alongside the public-domain Field Manuals. Books default to
// access="private" so they are only ever served to signed-in users — keep it
// that way for in-copyright material.
//
// Books are NOT bundled in this repo (they are copyrighted). Convert the book
// to Markdown yourself first — e.g. `python pdf_to_md.py` against a PDF you are
// licensed to use — then point this script at the .md file.
//
// Usage:
//   npx tsx scripts/ingest-book.ts \
//     --file ./books/reframing-organizations.md \
//     --title "Reframing Organizations" \
//     --ref "Bolman & Deal 2021" \
//     --author "Lee G. Bolman; Terrence E. Deal" \
//     --citation "Bolman, L. G., & Deal, T. E. (2021). Reframing Organizations: Artistry, Choice, and Leadership (7th ed.). Jossey-Bass." \
//     [--access private|public]
//
// After ingesting, rebuild the retrieval index:
//   npm run search:index                 # JSON path (default)
//   npm run index:db                     # OPTIONAL Postgres FTS path
//
// The row is upserted on `filename`, so re-running with the same file updates
// in place rather than duplicating.

import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sources } from "../src/db/schema";

const db = drizzle(neon(process.env.DATABASE_URL!), {});

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const file = arg("file");
  const title = arg("title");
  const ref = arg("ref"); // short citation key, stored in fm_number
  const author = arg("author");
  const citation = arg("citation");
  const access = arg("access") === "public" ? "public" : "private";
  const confirmPublic = flag("confirm-public");

  if (!file || !title || !ref) {
    console.error(
      "Missing required args. Need --file, --title, and --ref.\n" +
        "See the header of scripts/ingest-book.ts for full usage.",
    );
    process.exit(1);
  }

  // Books are copyrighted by default — refuse to ingest as `public` unless the
  // caller explicitly opts in with --confirm-public. Without this, a careless
  // `--access public` flag would expose in-copyright material to anonymous users.
  if (access === "public" && !confirmPublic) {
    console.error(
      "Books are private by design. To override, pass --confirm-public " +
        "alongside --access public.",
    );
    process.exit(1);
  }
  if (access === "public" && confirmPublic) {
    console.warn(
      "WARNING: ingesting book as access=public. Confirm you hold the rights.",
    );
  }

  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const content = fs.readFileSync(abs, "utf-8");
  const filename = path.basename(abs, ".md");
  const char_count = content.length;
  const word_count = content.split(/\s+/).filter(Boolean).length;

  await db
    .insert(sources)
    .values({
      fm_number: ref,
      title,
      filename,
      content,
      source_type: "book",
      access,
      author: author ?? null,
      citation: citation ?? null,
      word_count,
      char_count,
    })
    .onConflictDoUpdate({
      target: sources.filename,
      set: {
        fm_number: ref,
        title,
        content,
        source_type: "book",
        access,
        author: author ?? null,
        citation: citation ?? null,
        word_count,
        char_count,
      },
    });

  console.log(
    `Ingested book "${title}" (${ref}) — ${word_count.toLocaleString()} words, access=${access}.\n` +
      `Next: rebuild the index with \`npm run search:index\` (and \`npm run index:db\` if using the Postgres path).`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
