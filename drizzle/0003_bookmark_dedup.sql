-- Migration: dedupe whole-FM bookmarks and enforce NULLS NOT DISTINCT.
--
-- The user_bookmarks unique index (user_id, fm_id, anchor) treated NULL anchors
-- as distinct, so bookmarking a whole manual (anchor = NULL) twice inserted
-- duplicate rows instead of deduping on upsert. This removes existing
-- duplicates, then recreates the index with NULLS NOT DISTINCT so the POST
-- onConflict path dedupes correctly going forward.
--
-- NOTE: not executed against a live database in this worktree. Apply with
-- `npm run db:migrate`.

-- Remove duplicate whole-FM (anchor IS NULL) bookmarks, keeping the lowest id.
DELETE FROM "user_bookmarks" a
USING "user_bookmarks" b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.fm_id = b.fm_id
  AND a.anchor IS NULL
  AND b.anchor IS NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "user_bookmarks_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "user_bookmarks_unique"
  ON "user_bookmarks" ("user_id", "fm_id", "anchor") NULLS NOT DISTINCT;
