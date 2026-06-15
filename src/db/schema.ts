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

// The corpus table. Originally FM-only ("field_manuals"); generalized to a
// neutral "sources" concept so it can also hold curated reference works (books)
// alongside the public-domain Army Field Manuals. Each row is one source.
//
//   source_type — "doctrine" (public-domain FM) | "book" (curated reference)
//   access      — "public" (servable to anyone) | "private" (signed-in only)
//
// fm_number/title stay generic: for a book, fm_number holds a short citation
// key (e.g. "Bolman & Deal 2017") and title holds the work's title. author and
// citation carry the extra bibliographic detail books need and FMs don't.
//
// NOTE: the physical table was renamed field_manuals -> sources in
// drizzle/0001_sources_generalize.sql, but the foreign-key COLUMNS on the
// user-data tables below remain named `fm_id` (now meaning "source id") so
// existing rows, deep links, and the /fm/[id] reader URL keep working.
export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  fm_number: text("fm_number").notNull(),
  title: text("title").notNull(),
  filename: text("filename").notNull().unique(),
  content: text("content").notNull(),
  source_type: text("source_type").notNull().default("doctrine"), // "doctrine" | "book"
  access: text("access").notNull().default("public"), // "public" | "private"
  author: text("author"), // books only; null for FMs
  citation: text("citation"), // full bibliographic citation; books only
  word_count: integer("word_count").notNull().default(0),
  char_count: integer("char_count").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Back-compat alias: a lot of code imported `fieldManuals`. The concept is now
// `sources`; this alias keeps any stragglers working and eases the transition.
export const fieldManuals = sources;

// Section-level table backing the OPTIONAL Postgres full-text retrieval path
// (see src/lib/retrieve-pg.ts). This mirrors the rows produced by
// scripts/build-search-index.ts so a query result can reconstruct the
// `Section` shape (f, n, ft, a, h, c, b) the API returns.
//
// source_type/access mirror the parent source row so the Postgres retrieval
// path can gate private content without a join. The tsvector GIN index over
// (heading + crumb + body) is created in a SQL migration — drizzle-kit cannot
// express a generated/expression tsvector index here, so it is hand-written.
// See drizzle/0000_fm_sections_fts.sql.
export const fmSections = pgTable(
  "fm_sections",
  {
    id: serial("id").primaryKey(),
    // FK -> sources.id (mirrors Section.f)
    fm_id: integer("fm_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    anchor: text("anchor").notNull(), // Section.a (deep-link id)
    heading: text("heading").notNull(), // Section.h
    crumb: text("crumb").notNull().default(""), // Section.c
    body: text("body").notNull().default(""), // Section.b
    fm_number: text("fm_number").notNull(), // Section.n
    fm_title: text("fm_title").notNull(), // Section.ft
    source_type: text("source_type").notNull().default("doctrine"), // mirrors sources.source_type
    access: text("access").notNull().default("public"), // mirrors sources.access
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
    fm_id: integer("fm_id").references(() => sources.id, {
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
      .references(() => sources.id, { onDelete: "cascade" }),
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
      .references(() => sources.id, { onDelete: "cascade" }),
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
      .references(() => sources.id, { onDelete: "cascade" }),
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
