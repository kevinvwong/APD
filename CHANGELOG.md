# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Full-text search, markdown rendering, README, and robust DB init (draft PR)

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
