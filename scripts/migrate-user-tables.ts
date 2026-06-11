// scripts/migrate-user-tables.ts
// Creates the user-data tables (conversations, messages, user_bookmarks,
// user_recents, user_highlights) in Neon. Uses DATABASE_URL_UNPOOLED for DDL.
// Idempotent — safe to run multiple times.
//
// Run: npx tsx scripts/migrate-user-tables.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!;
const sql = neon(url);

async function main() {
  console.log("Creating conversations table…");
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id          serial PRIMARY KEY,
      user_id     text NOT NULL,
      fm_id       integer REFERENCES field_manuals(id) ON DELETE SET NULL,
      title       text NOT NULL DEFAULT '',
      mode        text NOT NULL DEFAULT 'library',
      created_at  timestamp DEFAULT now() NOT NULL,
      updated_at  timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversations_user_idx
      ON conversations (user_id, updated_at DESC)
  `;

  console.log("Creating messages table…");
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id              serial PRIMARY KEY,
      conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            text NOT NULL,
      text            text NOT NULL,
      sources         jsonb,
      starred         boolean NOT NULL DEFAULT false,
      created_at      timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_conversation_idx
      ON messages (conversation_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_starred_idx
      ON messages (starred)
  `;

  console.log("Creating user_bookmarks table…");
  await sql`
    CREATE TABLE IF NOT EXISTS user_bookmarks (
      id          serial PRIMARY KEY,
      user_id     text NOT NULL,
      fm_id       integer NOT NULL REFERENCES field_manuals(id) ON DELETE CASCADE,
      anchor      text,
      note        text,
      created_at  timestamp DEFAULT now() NOT NULL
    )
  `;
  // Unique with nullable anchor — use COALESCE so null anchor counts as a single bookmark
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_bookmarks_unique
      ON user_bookmarks (user_id, fm_id, COALESCE(anchor, ''))
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_bookmarks_user_idx
      ON user_bookmarks (user_id, created_at DESC)
  `;

  console.log("Creating user_recents table…");
  await sql`
    CREATE TABLE IF NOT EXISTS user_recents (
      user_id       text NOT NULL,
      fm_id         integer NOT NULL REFERENCES field_manuals(id) ON DELETE CASCADE,
      last_anchor   text,
      last_read_at  timestamp DEFAULT now() NOT NULL,
      PRIMARY KEY (user_id, fm_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_recents_user_idx
      ON user_recents (user_id, last_read_at DESC)
  `;

  console.log("Creating user_highlights table…");
  await sql`
    CREATE TABLE IF NOT EXISTS user_highlights (
      id             serial PRIMARY KEY,
      user_id        text NOT NULL,
      fm_id          integer NOT NULL REFERENCES field_manuals(id) ON DELETE CASCADE,
      anchor         text NOT NULL,
      selected_text  text NOT NULL,
      note           text,
      color          text NOT NULL DEFAULT 'gold',
      created_at     timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_highlights_user_idx
      ON user_highlights (user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_highlights_fm_idx
      ON user_highlights (user_id, fm_id)
  `;

  // Verify
  const [{ count: cCount }] = await sql`SELECT count(*) FROM conversations`;
  const [{ count: mCount }] = await sql`SELECT count(*) FROM messages`;
  const [{ count: bCount }] = await sql`SELECT count(*) FROM user_bookmarks`;
  const [{ count: rCount }] = await sql`SELECT count(*) FROM user_recents`;
  const [{ count: hCount }] = await sql`SELECT count(*) FROM user_highlights`;
  console.log(
    `\nReady. conversations:${cCount} messages:${mCount} bookmarks:${bCount} recents:${rCount} highlights:${hCount}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
