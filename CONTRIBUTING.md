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

### Dependency versions: TypeScript 6 and @types/node 25

This project deliberately tracks the bleeding edge of TypeScript and the `@types/node` definitions, ahead of the typical "current stable" range. CI runs Node 22 LTS (see `.github/workflows/ci.yml`), but the type defs are pinned to the latest available `@types/node` so we surface upcoming Node API shapes before they land in our runtime.

If `tsc --noEmit` flags a built-in API as unknown, check the runtime — Node 22 may not have the API the types describe. The reverse (runtime has it, types don't) shouldn't happen with this versioning.

If you're adding a dependency that's incompatible with TS 6, prefer reporting it upstream over downgrading the project's TS version.

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
