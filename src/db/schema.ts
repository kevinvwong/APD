import { pgTable, serial, text, integer, timestamp, jsonb, date, index } from "drizzle-orm/pg-core";
import type { TocEntry } from "../lib/toc";

export const fieldManuals = pgTable(
  "field_manuals",
  {
    id:        serial("id").primaryKey(),
    fm_number: text("fm_number").notNull(),
    title:     text("title").notNull(),
    filename:  text("filename").notNull().unique(),
    content:   text("content").notNull(),
    word_count:  integer("word_count").notNull().default(0),
    char_count:  integer("char_count").notNull().default(0),
    toc:         jsonb("toc").$type<TocEntry[]>().notNull().default([]),
    fm_series:   text("fm_series").notNull().default("?"),
    publication_date: date("publication_date"),
    chapter_count:    integer("chapter_count").notNull().default(0),
    created_at:  timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("field_manuals_fm_series_idx").on(t.fm_series)]
);
