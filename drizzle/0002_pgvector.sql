-- Migration: pgvector embeddings on fm_sections, for the OPTIONAL hybrid
-- retrieval path (src/lib/retrieve-hybrid.ts). Additive — does not touch the
-- existing keyword (tsvector) path.
--
-- The vector dimension (1536) matches the default embeddings model
-- (OpenAI text-embedding-3-small). If you embed with a different model, change
-- this dimension AND src/lib/embed.ts to match.
--
-- NOTE: This SQL has NOT been executed against a live database in this worktree.
-- Run it via `npm run db:migrate` or apply it manually. Neon supports pgvector;
-- `CREATE EXTENSION vector` enables it.

CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "fm_sections" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
--> statement-breakpoint
-- HNSW index for cosine distance (<=>). Built once embeddings are populated
-- (scripts/embed-sections.ts); harmless to create on an empty/NULL column.
CREATE INDEX IF NOT EXISTS "fm_sections_embedding_hnsw"
	ON "fm_sections" USING hnsw ("embedding" vector_cosine_ops);
