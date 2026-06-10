-- Full-text search support for field_manuals.
-- Hand-written because Drizzle/drizzle-kit cannot express GENERATED STORED
-- columns or GIN indexes. Applied via `npm run db:sql` (idempotent).

-- Weighted tsvector: fm_number/title rank highest (A), filename next (B),
-- body content lowest (C). STORED so it repopulates automatically on write.
ALTER TABLE field_manuals
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(fm_number, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')),     'A') ||
    setweight(to_tsvector('english', coalesce(filename, '')),  'B') ||
    setweight(to_tsvector('english', coalesce(content, '')),   'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS field_manuals_search_tsv_idx
  ON field_manuals USING GIN (search_tsv);
