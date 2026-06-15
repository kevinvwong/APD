// scripts/ingest-books.ts
// Batch-ingest the curated open-license reference corpus described in
// books/manifest.json into the `sources` table — one row per book, source_type
// "book". Every title in the manifest is public-domain or CC-licensed and so
// `access` defaults to "public" (still only browsable by signed-in users in the
// app, but legitimately redistributable). Attribution is carried into the DB via
// each book's `citation`.
//
// For `fetch: "auto"`-style entries (gutenberg-txt | html | text) the script
// downloads from `url` and converts to Markdown at books/<id>.md, then ingests.
// For `fetch: "manual"` entries (multi-page OpenStax/Pressbooks textbooks) it
// expects you to have already produced books/<id>.md via the official export +
// pdf_to_md.py; otherwise it skips them with a note.
//
// Usage:
//   npm run books:ingest-all                 # fetch (if needed) + ingest every entry
//   npm run books:ingest-all -- --only taylor-scientific-management
//   npm run books:ingest-all -- --no-fetch   # ingest only books/<id>.md already on disk
//
// After ingesting, rebuild the retrieval index:
//   npm run search:index                     # JSON path (default)
//   npm run index:db                         # OPTIONAL Postgres FTS path
//
// NOTE: the network fetch + conversion here has NOT been exercised in this
// worktree (no outbound access to these hosts). Run it on a machine with open
// network + DATABASE_URL set.

import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sources } from "../src/db/schema";
import {
  stripGutenberg,
  htmlToMarkdown,
  plainTextToMarkdown,
} from "./book-convert";

const db = drizzle(neon(process.env.DATABASE_URL!), {});
const BOOKS_DIR = path.join(process.cwd(), "books");

interface Book {
  id: string;
  title: string;
  ref: string;
  author?: string;
  citation?: string;
  access?: string;
  license?: string;
  fetch: "gutenberg-txt" | "html" | "text" | "manual";
  url?: string;
  note?: string;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function fetchToMarkdown(book: Book): Promise<string> {
  if (!book.url) throw new Error(`No url for ${book.id}`);
  const res = await fetch(book.url, {
    headers: { "User-Agent": "APD-book-ingest/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${book.url}`);
  const raw = await res.text();
  const heading = `# ${book.title}\n\n`;
  switch (book.fetch) {
    case "gutenberg-txt":
      return heading + plainTextToMarkdown(stripGutenberg(raw));
    case "html":
      return heading + htmlToMarkdown(raw);
    case "text":
      return heading + plainTextToMarkdown(raw);
    default:
      throw new Error(`Cannot auto-fetch fetch="${book.fetch}" for ${book.id}`);
  }
}

async function ingest(book: Book, content: string): Promise<void> {
  const char_count = content.length;
  const word_count = content.split(/\s+/).filter(Boolean).length;
  const access = book.access === "private" ? "private" : "public";
  await db
    .insert(sources)
    .values({
      fm_number: book.ref,
      title: book.title,
      filename: book.id,
      content,
      source_type: "book",
      access,
      author: book.author ?? null,
      citation: book.citation ?? null,
      word_count,
      char_count,
    })
    .onConflictDoUpdate({
      target: sources.filename,
      set: {
        fm_number: book.ref,
        title: book.title,
        content,
        source_type: "book",
        access,
        author: book.author ?? null,
        citation: book.citation ?? null,
        word_count,
        char_count,
      },
    });
  console.log(
    `  ✓ ${book.ref} — "${book.title}" (${word_count.toLocaleString()} words, access=${access})`,
  );
}

async function main() {
  const manifestPath = path.join(BOOKS_DIR, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    books: Book[];
  };
  const only = flagValue("only");
  const noFetch = hasFlag("no-fetch");
  const list = only ? manifest.books.filter((b) => b.id === only) : manifest.books;
  if (!list.length) {
    console.error(only ? `No manifest entry with id "${only}".` : "Manifest is empty.");
    process.exit(1);
  }

  let ingested = 0;
  const skipped: string[] = [];
  for (const book of list) {
    const mdPath = path.join(BOOKS_DIR, `${book.id}.md`);
    let content: string | null = null;

    if (fs.existsSync(mdPath)) {
      content = fs.readFileSync(mdPath, "utf-8");
    } else if (book.fetch !== "manual" && !noFetch) {
      try {
        console.log(`  …fetching ${book.id} from ${book.url}`);
        content = await fetchToMarkdown(book);
        fs.writeFileSync(mdPath, content); // cache for reproducibility
      } catch (e) {
        console.error(`  ✗ fetch failed for ${book.id}: ${(e as Error).message}`);
        skipped.push(book.id);
        continue;
      }
    }

    if (!content) {
      skipped.push(book.id);
      console.warn(
        `  ⏭  ${book.id} — no books/${book.id}.md` +
          (book.fetch === "manual"
            ? ` (manual source: ${book.note ?? book.url})`
            : ""),
      );
      continue;
    }
    await ingest(book, content);
    ingested++;
  }

  console.log(`\nDone. ${ingested} book(s) ingested.`);
  if (skipped.length) {
    console.log(`Skipped (need books/<id>.md): ${skipped.join(", ")}`);
  }
  console.log(
    "Next: rebuild the index with `npm run search:index` (and `npm run index:db` if using the Postgres path).",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
