import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const fieldManuals = pgTable("field_manuals", {
  id: serial("id").primaryKey(),
  fm_number: text("fm_number").notNull(),
  title: text("title").notNull(),
  filename: text("filename").notNull().unique(),
  content: text("content").notNull(),
  word_count: integer("word_count").notNull().default(0),
  char_count: integer("char_count").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Section-level table backing the OPTIONAL Postgres full-text retrieval path
// (see src/lib/retrieve-pg.ts). This mirrors the rows produced by
// scripts/build-search-index.ts so a query result can reconstruct the
// `Section` shape (f, n, ft, a, h, c, b) the API returns.
//
// The tsvector GIN index over (heading + crumb + body) is created in a SQL
// migration — drizzle-kit cannot express a generated/expression tsvector index
// here, so it is hand-written. See drizzle/0000_fm_sections_fts.sql.
export const fmSections = pgTable(
  "fm_sections",
  {
    id: serial("id").primaryKey(),
    // FK -> field_manuals.id (mirrors Section.f)
    fm_id: integer("fm_id")
      .notNull()
      .references(() => fieldManuals.id, { onDelete: "cascade" }),
    anchor: text("anchor").notNull(), // Section.a (deep-link id)
    heading: text("heading").notNull(), // Section.h
    crumb: text("crumb").notNull().default(""), // Section.c
    body: text("body").notNull().default(""), // Section.b
    fm_number: text("fm_number").notNull(), // Section.n
    fm_title: text("fm_title").notNull(), // Section.ft
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // One row per (manual, anchor) so re-indexing can upsert idempotently.
    fmAnchorUq: uniqueIndex("fm_sections_fm_id_anchor_uq").on(
      t.fm_id,
      t.anchor,
    ),
  }),
);

// ============================================================================
// User-data tables — keyed by Clerk user_id (string).
// All authenticated content; per-user data is isolated by the API layer
// querying with WHERE user_id = auth().userId.
// ============================================================================

/** A persisted Ask conversation. fm_id null = library-wide chat. */
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    user_id: text("user_id").notNull(), // Clerk user id (e.g. "user_2abc…")
    fm_id: integer("fm_id").references(() => fieldManuals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull().default(""), // derived from first question
    mode: text("mode").notNull().default("library"), // "library" | "open"
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("conversations_user_idx").on(t.user_id, t.updated_at),
  }),
);

/** Q+A turns inside a conversation, ordered by created_at. */
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversation_id: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    text: text("text").notNull(),
    // Array of { f, n, ft, a, h, c } source objects when role=assistant
    sources: jsonb("sources").$type<unknown[]>(),
    starred: boolean("starred").notNull().default(false),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    convoIdx: index("messages_conversation_idx").on(
      t.conversation_id,
      t.created_at,
    ),
    starredIdx: index("messages_starred_idx").on(t.starred),
  }),
);

/** Per-user bookmarks on field manuals (optionally at a section anchor). */
export const userBookmarks = pgTable(
  "user_bookmarks",
  {
    id: serial("id").primaryKey(),
    user_id: text("user_id").notNull(),
    fm_id: integer("fm_id")
      .notNull()
      .references(() => fieldManuals.id, { onDelete: "cascade" }),
    anchor: text("anchor"), // null = whole-FM bookmark
    note: text("note"),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uq: uniqueIndex("user_bookmarks_unique").on(t.user_id, t.fm_id, t.anchor),
    userIdx: index("user_bookmarks_user_idx").on(t.user_id, t.created_at),
  }),
);

/** Per-user recently-read tracker (one row per FM). */
export const userRecents = pgTable(
  "user_recents",
  {
    user_id: text("user_id").notNull(),
    fm_id: integer("fm_id")
      .notNull()
      .references(() => fieldManuals.id, { onDelete: "cascade" }),
    last_anchor: text("last_anchor"),
    last_read_at: timestamp("last_read_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: uniqueIndex("user_recents_pk").on(t.user_id, t.fm_id),
    userIdx: index("user_recents_user_idx").on(t.user_id, t.last_read_at),
  }),
);

/** Per-user highlights attached to a specific section + selected text. */
export const userHighlights = pgTable(
  "user_highlights",
  {
    id: serial("id").primaryKey(),
    user_id: text("user_id").notNull(),
    fm_id: integer("fm_id")
      .notNull()
      .references(() => fieldManuals.id, { onDelete: "cascade" }),
    anchor: text("anchor").notNull(), // section data-hid the highlight lives in
    selected_text: text("selected_text").notNull(),
    note: text("note"),
    color: text("color").notNull().default("gold"), // gold | olive | red
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("user_highlights_user_idx").on(t.user_id, t.created_at),
    fmIdx: index("user_highlights_fm_idx").on(t.user_id, t.fm_id),
  }),
);
