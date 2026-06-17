# Reference corpus (books)

Open-license organization & management theory texts that complement the Army
Field Manuals. Each is ingested as a `book` source (see `src/db/schema.ts`).
Every title here is **public-domain or openly (CC) licensed**, so it is ingested
as `access: public` — legitimately redistributable, with attribution carried
into the DB via each book's `citation`.

> Books are **not** committed to this repo by default. Run the pipeline below to
> fetch/convert them locally, then ingest. (PDFs of the in-copyright staples —
> _Classics of Organization Theory_, _Reframing Organizations_ — are **not**
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

| Title                                                     | License         | Fetch  | Obtained via                                                  |
| --------------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------- |
| Taylor — _The Principles of Scientific Management_ (1911) | Public domain   | auto   | Gutenberg plain text                                          |
| Follett — _The New State_ (1918)                          | Public domain   | auto   | Standard Ebooks HTML                                          |
| OpenStax — _Organizational Behavior_ (2019)               | CC BY 4.0       | manual | Internet Archive text-PDF → `scripts/book-pdf-to-md.py`       |
| OpenStax — _Principles of Management_ (2019)              | CC BY 4.0       | manual | Internet Archive text-PDF → `scripts/book-pdf-to-md.py`       |
| Bauer & Erdogan — _Organizational Behavior_ (2010)        | CC BY-NC-SA 3.0 | manual | Flat World PDF (LMS-hosted) → `scripts/book-pdf-to-md.py`     |
| Renfro — _Public Administration: The Essentials_ (2023)   | CC BY-NC-SA 4.0 | manual | UMN Manifold reader API → `scripts/fetch-renfro-manifold.mjs` |

**auto** entries are downloaded and converted to Markdown by
`scripts/ingest-books.ts` directly from the manifest `url`. **manual** entries
could not be fetched headlessly (the publisher landing pages are JS-gated, the
PDFs need font-size heading extraction, or the host blocks non-browser clients) —
each manifest entry's `note` records the exact verified source and obtain method.
Produce `books/<id>.md` out-of-band per the `note`, then run
`npm run books:ingest-all -- --no-fetch` — it ingests every `books/<id>.md`
present and skips the rest.

> **Dropped:** Follett — _Creative Experience_ (1924). Its only available sources
> are scanned OCR (Internet Archive djvu/PDF), which produced unusable section
> structure (page numbers and OCR garble parsed as headings). Re-add only if a
> born-digital edition (Gutenberg/Standard Ebooks) appears.
>
> **Lesson:** validate converted **structure** (sane headings), not just word
> count, before ingesting — `--dry-run` reports words but a clean count can still
> hide an OCR blob. Spot-check `grep "^#" books/<id>.md` head _and_ tail.

## Authored sources (`books/authored/`)

Some `book` sources are **original APD-written content**, not fetched works.
These are summaries we author in our own words — useful when a framework is
valuable to reference but is proprietary/copyrighted and so cannot be ingested as
text (e.g. ITIL). They are **not** in `manifest.json` (it models only fetched
works, which need a `fetch` type + URL). Unlike the fetched-book `.md` cache,
**authored `.md` files ARE the canonical source and are committed to the repo** —
there is no upstream to regenerate them from.

Ingest one with the single-source script (it upserts on filename):

```bash
npx tsx scripts/ingest-book.ts \
  --file ./books/authored/itil4-overview-and-crosswalk.md \
  --title "ITIL 4: An Overview and Doctrine Crosswalk" \
  --ref "ITIL 4 Overview (APD)" \
  --author "APD (original summary)" \
  --citation "APD. ITIL 4: …. ITIL® is a trademark of AXELOS/PeopleCert; independent, not endorsed." \
  --access public
npm run search:index
```

| Title                                        | Note                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _ITIL 4: An Overview and Doctrine Crosswalk_ | Original summary of the ITIL® 4 framework + a crosswalk to the FM/management corpus. ITIL® is a registered trademark of AXELOS/PeopleCert; this work is independent and not endorsed by them. Refers to the framework nominatively; reproduces none of the official guidance. |

## License notes

- **CC BY** (OpenStax) — reuse freely with attribution.
- **CC BY-NC-SA** (Bauer & Erdogan; Renfro) — attribution + ShareAlike +
  **NonCommercial**. Fine for a personal / auth-gated study tool; revisit if APD
  ever becomes a commercial offering.
- Attribution for every title is stored in the source row's `citation` and shown
  with the source.
