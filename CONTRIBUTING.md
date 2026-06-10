# Contributing

## Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) Postgres database
- An [Anthropic](https://console.anthropic.com/) API key

## Setup

```bash
git clone https://github.com/kevinvwong/APD.git
cd APD
npm install
cp .env.example .env.local
# Fill in all four values in .env.local
npm run db:seed        # requires DATABASE_URL
npm run search:index   # requires DATABASE_URL, writes src/data/search-index.json
npm run dev
```

**Important:** `DATABASE_URL_UNPOOLED` must be set before running any `npm run db:*` command. Drizzle Kit uses the direct (non-pooled) connection for migrations. Running without it will crash silently or with a confusing error.

## Making changes

```bash
# Typecheck before committing
npx tsc --noEmit

# If you change any FM markdown source files, rebuild the search index
npm run search:index
git add src/data/search-index.json
```

## Commit style

Use a short imperative subject line. The recent commit history is a good reference:

```
Add doctrine assistant: AI ask panel, FM parser, section search index
Fix self-test findings: search index, anchor links, list grouping, retrieval
```

## Merge strategy

Squash merge only. Keep PRs focused — one concern per PR.

## Versioning

Tags follow semver. Patch for bug-only fixes, minor for new features, major for breaking changes.
