# APD — Army Field Manuals

A small [Next.js](https://nextjs.org) web app that serves a browsable,
full-text-searchable library of U.S. Army Field Manuals (FMs), sourced from
[armypubs.army.mil](https://armypubs.army.mil).

The repo ships with **51 Field Manuals** as markdown (`fm-md/`). A seed script
parses each file's FM number, title, and word/character counts and loads them
into a Postgres table; the app then lets you search and read them.

## Stack

- **Next.js 15** (App Router, React 19)
- **Tailwind CSS v4** + `@tailwindcss/typography`
- **Drizzle ORM** on **Neon** serverless Postgres
- **react-markdown** + **remark-gfm** for rendering manual content
- **TypeScript**

## Features

- **Browse** all active FMs, ordered by FM number.
- **Search** by FM number, title, filename, *or full text* of the manual.
  Body matches show a short excerpt of the surrounding context.
- **Read** any manual with proper markdown rendering (headings, tables, lists).

## Getting started

You'll need a free [Neon](https://neon.tech) Postgres database for `DATABASE_URL`.

```bash
npm install

# Configure the database connection
cp .env.example .env.local
# → set DATABASE_URL (and DATABASE_URL_UNPOOLED) in .env.local

npm run db:push    # create the field_manuals table
npm run db:seed    # load the 51 markdown FMs from fm-md/ into the DB

npm run dev        # http://localhost:3000
```

## Scripts

| Script               | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start the dev server                         |
| `npm run build`      | Production build                             |
| `npm run start`      | Serve the production build                   |
| `npm run lint`       | Run ESLint                                   |
| `npm run db:generate`| Generate Drizzle migrations from the schema  |
| `npm run db:migrate` | Apply migrations                             |
| `npm run db:push`    | Push the schema directly to the database     |
| `npm run db:seed`    | Seed the database from `fm-md/`              |

## Project layout

```
fm-md/                     # 51 Field Manuals as markdown (source data)
src/
  app/
    page.tsx               # Home — list + full-text search
    fm/[id]/page.tsx       # Single manual, rendered markdown
    layout.tsx
    globals.css
  db/
    schema.ts              # Drizzle schema (field_manuals)
    index.ts               # Neon/Drizzle client
    seed.ts                # Parse fm-md/ and load into Postgres
drizzle.config.ts
```

## Data source

Field manuals are public-domain U.S. Army doctrine published by the Army
Publishing Directorate at [armypubs.army.mil](https://armypubs.army.mil).
