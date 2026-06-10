import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const fieldManuals = pgTable("field_manuals", {
  id:        serial("id").primaryKey(),
  fm_number: text("fm_number").notNull(),
  title:     text("title").notNull(),
  filename:  text("filename").notNull().unique(),
  content:   text("content").notNull(),
  word_count:  integer("word_count").notNull().default(0),
  char_count:  integer("char_count").notNull().default(0),
  created_at:  timestamp("created_at").defaultNow().notNull(),
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
    id:        serial("id").primaryKey(),
    // FK -> field_manuals.id (mirrors Section.f)
    fm_id:     integer("fm_id")
      .notNull()
      .references(() => fieldManuals.id, { onDelete: "cascade" }),
    anchor:    text("anchor").notNull(),    // Section.a (deep-link id)
    heading:   text("heading").notNull(),   // Section.h
    crumb:     text("crumb").notNull().default(""), // Section.c
    body:      text("body").notNull().default(""),  // Section.b
    fm_number: text("fm_number").notNull(), // Section.n
    fm_title:  text("fm_title").notNull(),  // Section.ft
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // One row per (manual, anchor) so re-indexing can upsert idempotently.
    fmAnchorUq: uniqueIndex("fm_sections_fm_id_anchor_uq").on(t.fm_id, t.anchor),
  }),
);
