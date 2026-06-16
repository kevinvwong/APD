# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Full-text search, markdown rendering, README, and robust DB init (draft PR)

### Added

- **Generalized corpus model** — the FM-only `field_manuals` table is now a neutral `sources` table (`source_type`: `doctrine` | `book`; `access`: `public` | `private`; plus `author` / `citation` for books). Lets the library hold curated reference works — e.g. organization-theory texts — alongside the public-domain Field Manuals. Migration `drizzle/0001_sources_generalize.sql` is non-breaking: the FK columns stay named `fm_id`, the `/fm/[id]` reader URL is unchanged, and existing rows default to public doctrine.
- **Private-source gating** — retrieval (`src/lib/retrieve.ts` + the Postgres path) excludes `access = "private"` sources unless the Ask request is authenticated, so in-copyright book content is only ever served to signed-in users.
- **Book ingestion** — `npm run book:ingest` (`scripts/ingest-book.ts`) ingests a single Markdown-converted reference work as a private `book` source. Books are not bundled (copyright); supply your own licensed Markdown.
- **Reference Library + Ask scope** — the catalog now splits doctrinal series from a dedicated "Reference Library" section (with a rail filter), so book sources surface properly instead of being dropped from the by-number series view. The library-wide Ask gains an All / Field Manuals / Reference corpus scope (threaded through both retrieval paths), and cited book sources get a "Book" tag.
- **Semantic / hybrid retrieval** — OPTIONAL `RETRIEVE_BACKEND=hybrid` fuses the Postgres keyword path with pgvector semantic search via Reciprocal Rank Fusion (`src/lib/rank-fusion.ts`, unit-tested). Adds a provider-agnostic embeddings client (`src/lib/embed.ts`; OpenAI default, Voyage optional), the `0002_pgvector` migration (embedding column + HNSW index), and `npm run embed:sections` to populate vectors. Degrades to keyword-only if embeddings are unavailable. Default `json` backend is unchanged.
- **Retrieval eval harness** — `npm run eval` scores a gold question set (`eval/retrieval-gold.json`) through the JSON backend and reports recall@k / MRR / section-recall, deterministically and offline. Metric math (`src/lib/eval-metrics.ts`) is unit-tested; `--min-recall` can gate. Baseline on the current keyword scoring: recall@8 ≈ 75%.

### Fixed

- **Schema/code drift on deploy** — migrations now run automatically as part of the build on Vercel **production** deploys (`scripts/migrate-on-deploy.ts`, gated by `VERCEL_ENV`), so schema and code ship together. Skipped in CI, previews, and local builds. Prevents recurrence of the `relation "sources" does not exist` outage where the `sources` code deployed before the rename migration was applied.

## [0.1.0] — 2026-06-10

### Added

- **Doctrine assistant** — `POST /api/ask` endpoint calls Claude with keyword-retrieved FM excerpts. Two modes: _Library only_ (citations from indexed FMs only) and _Model + Library_ (Claude's knowledge + FM excerpts).
- **FM parser** (`src/lib/fm-parse.ts`) — tolerant markdown parser producing typed blocks with stable anchor IDs for deep-linking.
- **Keyword search index** (`src/data/search-index.json`) — 5,840 sections across 51 FMs, built by `npm run search:index`. Heading hits weighted above body hits.
- **Ask panel** (`src/components/AskPanel.tsx`) — client component with mode toggle, conversation history, numbered citation badges, and source deep-links.
- **FM reader** — rewrote `src/app/fm/[id]/page.tsx` to render parsed blocks with `id` anchors so citation links scroll to the correct section. Includes table of contents.
- **Neon + Drizzle setup** — `field_manuals` table, seed script for all 51 active FMs sourced from armypubs.army.mil.

### Fixed

- Table rows after figure captions were silently dropped (debris guard ordering)
- Unanchored `isLeaderLine` regex dropped valid paragraph text containing ellipses
- Bullets ending in dots were discarded as TOC leader lines
- Roman numeral heading filter matched real words (CIVIL, MILD, MIX, etc.)
- Consecutive asterisks in PDF-extracted content produced mismatched HTML tags
- Citation badge `#src-N` anchors had no matching DOM targets
- `restrictFm=0` falsiness check disabled FM filtering instead of restricting to it
- Error messages from the Anthropic SDK leaked to API clients
- Prompt injection possible via unsanitized `history[].text`
- `search-index.json` was gitignored, causing ENOENT on every `/api/ask` call in production

[Unreleased]: https://github.com/kevinvwong/APD/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kevinvwong/APD/releases/tag/v0.1.0
