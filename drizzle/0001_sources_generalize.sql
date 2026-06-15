-- Migration: generalize the FM-only corpus into a neutral "sources" concept so
-- it can hold curated reference works (books) alongside the public-domain Army
-- Field Manuals. See src/db/schema.ts.
--
-- This is non-breaking by design:
--   * the table is RENAMED field_manuals -> sources (foreign keys follow the
--     table automatically in Postgres, so existing fm_id references survive);
--   * the user-data FK COLUMNS stay named `fm_id` (now meaning "source id");
--   * the /fm/[id] reader URL is unchanged.
--
-- New columns are additive with safe defaults, so every pre-existing row is
-- classified as a public-domain doctrine source with no backfill needed.
--
-- NOTE: This SQL has NOT been executed against a live database in this
-- worktree. Run it via `npm run db:migrate` (drizzle-kit migrate) or apply it
-- manually against the Neon/Postgres instance.

-- Rename the corpus table (idempotent: skip if already renamed). The existing
-- fm_sections / user-data foreign keys point at it by identity, so they update
-- transparently.
DO $$ BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables
	           WHERE table_schema = 'public' AND table_name = 'field_manuals')
	   AND NOT EXISTS (SELECT 1 FROM information_schema.tables
	                   WHERE table_schema = 'public' AND table_name = 'sources') THEN
		ALTER TABLE "field_manuals" RENAME TO "sources";
	END IF;
END $$;
--> statement-breakpoint
-- Neutral source classification + book bibliographic fields. Defaults classify
-- every existing FM row as a public, public-domain doctrine source.
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'doctrine' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "access" text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "author" text;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "citation" text;
--> statement-breakpoint
-- Mirror source_type/access onto the section index so the OPTIONAL Postgres
-- retrieval path (src/lib/retrieve-pg.ts) can gate private content without a
-- join back to sources.
ALTER TABLE "fm_sections" ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'doctrine' NOT NULL;
--> statement-breakpoint
ALTER TABLE "fm_sections" ADD COLUMN IF NOT EXISTS "access" text DEFAULT 'public' NOT NULL;
