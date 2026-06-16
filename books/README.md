# Reference corpus (books)

Open-license organization & management theory texts that complement the Army
Field Manuals. Each is ingested as a `book` source (see `src/db/schema.ts`).
Every title here is **public-domain or openly (CC) licensed**, so it is ingested
as `access: public` — legitimately redistributable, with attribution carried
into the DB via each book's `citation`.

> Books are **not** committed to this repo by default. Run the pipeline below to
> fetch/convert them locally, then ingest. (PDFs of the in-copyright staples —
> *Classics of Organization Theory*, *Reframing Organizations* — are **not**
> included and should be added only as `private` sources if you are licensed.)

## One-command ingest

Requires `DATABASE_URL` in `.env.local` and open network access.

```bash
npm run books:ingest-all        # fetch (if needed) + convert + ingest every manifest entry
npm run search:index            # rebuild the retrieval index
# npm run index:db              # OPTIONAL: also populate the Postgres FTS path
```

Useful flags:

```bash
npm run books:ingest-all -- --only taylor-scientific-management
npm run books:ingest-all -- --no-fetch   # ingest only books/<id>.md already on disk
npm run books:ingest-all -- --dry-run    # fetch + convert to books/<id>.md, no DB write
```

`--dry-run` needs neither a database nor any env — use it to preview the
fetched/converted Markdown (and eyeball conversion quality) before committing to
an ingest. Fetches have a timeout + one retry and reject suspiciously short
output (an error page won't be silently stored).

After (re)building the index, `npm run check:index` validates that
`src/data/search-index.json` is present, parseable, and well-formed. CI runs it
on every PR so a missing or corrupt index can't ship.

## The corpus (`manifest.json`)

| Title | License | Fetch |
| ----- | ------- | ----- |
| Taylor — *The Principles of Scientific Management* (1911) | Public domain | auto (Gutenberg) |
| Follett — *The New State* (1918) | Public domain | auto (Standard Ebooks) |
| Follett — *Creative Experience* (1924) | Public domain | auto (Internet Archive) |
| OpenStax — *Organizational Behavior* (2019) | CC BY 4.0 | manual |
| OpenStax — *Principles of Management* (2019) | CC BY 4.0 | manual |
| Bauer & Erdogan — *Organizational Behavior* (2010) | CC BY-NC-SA 3.0 | manual |
| Renfro — *Public Administration: The Essentials* | CC BY-NC-SA 4.0 | manual |

**auto** entries are downloaded and converted to Markdown by
`scripts/ingest-books.ts`. **manual** entries are multi-page textbooks: download
the official PDF/EPUB from the `url` in the manifest, convert with
`python pdf_to_md.py` (or any heading-preserving converter) into
`books/<id>.md`, then re-run `npm run books:ingest-all` — it ingests every
`books/<id>.md` present and skips the rest.

## License notes

- **CC BY** (OpenStax) — reuse freely with attribution.
- **CC BY-NC-SA** (Bauer & Erdogan; Renfro) — attribution + ShareAlike +
  **NonCommercial**. Fine for a personal / auth-gated study tool; revisit if APD
  ever becomes a commercial offering.
- Attribution for every title is stored in the source row's `citation` and shown
  with the source.
