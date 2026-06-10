-- Migration: fm_sections table + tsvector GIN index for the OPTIONAL
-- Postgres full-text retrieval path (src/lib/retrieve-pg.ts).
--
-- This is hand-written because drizzle-kit cannot express the generated
-- tsvector column / expression GIN index below. It is ADDITIVE: it does not
-- touch the existing field_manuals table or the JSON retrieval path.
--
-- NOTE: This SQL has NOT been executed against a live database in this
-- worktree. Run it via `npm run db:migrate` (drizzle-kit migrate) or apply it
-- manually against a Neon/Postgres instance that already has field_manuals.

CREATE TABLE IF NOT EXISTS "fm_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"fm_id" integer NOT NULL,
	"anchor" text NOT NULL,
	"heading" text NOT NULL,
	"crumb" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"fm_number" text NOT NULL,
	"fm_title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "fm_sections" ADD CONSTRAINT "fm_sections_fm_id_field_manuals_id_fk"
		FOREIGN KEY ("fm_id") REFERENCES "public"."field_manuals"("id")
		ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fm_sections_fm_id_anchor_uq"
	ON "fm_sections" USING btree ("fm_id","anchor");
--> statement-breakpoint
-- Generated tsvector column weighting heading (A) + crumb (B) above body (C),
-- matching the JSON path's heading-over-body scoring. STORED so it is indexable.
ALTER TABLE "fm_sections" ADD COLUMN IF NOT EXISTS "fts" tsvector
	GENERATED ALWAYS AS (
		setweight(to_tsvector('english', coalesce("heading", '')), 'A') ||
		setweight(to_tsvector('english', coalesce("crumb", '')), 'B') ||
		setweight(to_tsvector('english', coalesce("body", '')), 'C')
	) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fm_sections_fts_gin" ON "fm_sections" USING gin ("fts");
