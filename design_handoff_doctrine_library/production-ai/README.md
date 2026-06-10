# Doctrine Assistant — Next.js handoff

Drop-in scaffolding to run the "Ask AI" feature in your real Next.js app with **your own
Anthropic API key**, server-side. The retrieval + prompt logic is identical to the prototype;
only the model call moves from the preview's built-in `window.claude.complete` to an
authenticated server request.

## Files (paths relative to your repo root)

| File | Purpose |
|------|---------|
| `src/lib/fm-parse.ts` | TS port of the FM markdown parser. Produces blocks + a section TOC with stable anchor ids. |
| `scripts/build-search-index.ts` | One-off: reads `field_manuals` from your DB, builds `src/data/search-index.json`. |
| `src/lib/retrieve.ts` | Server-side retrieval over the index (loaded once, cached per instance). |
| `src/lib/ask-prompt.ts` | Shared prompt builder + `library` / `open` modes. |
| `src/app/api/ask/route.ts` | `POST /api/ask` — retrieves, calls Claude with your key, returns `{ answer, sources }`. |
| `src/lib/ask-client.ts` | Client helper `askLibrary({ question, mode, fmId, history })`. |

## Setup

```bash
npm install @anthropic-ai/sdk
```

`.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5      # optional; pick any current model
```

Build the index (after your existing `npm run db:seed`):
```bash
npx tsx scripts/build-search-index.ts
```
Add it to `package.json` scripts if you like:
```json
"search:index": "tsx scripts/build-search-index.ts"
```

> The `@/` import alias used in the route resolves to `src/` via your existing `tsconfig.json`
> (`"paths": { "@/*": ["./src/*"] }`). Adjust if your alias differs.

## Use it from a component

```tsx
"use client";
import { useState } from "react";
import { askLibrary, sectionHref, type AskResult } from "@/lib/ask-client";

export function Ask() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      setRes(await askLibrary({ question: q, mode: "library" })); // or "open"
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} />
      <button onClick={go} disabled={busy}>Ask</button>
      {res && (
        <>
          <p>{res.answer /* render [n] citations + markdown like the prototype's Answer component */}</p>
          <ul>
            {res.sources.map((s, i) => (
              <li key={i}><a href={sectionHref(s)}>{s.n} — {s.h}</a></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

The prototype's `ask.jsx` already contains the `Answer` renderer (markdown + clickable `[n]`
citation badges) and the segmented `library` / `open` toggle — port that JSX into your component;
it calls `askLibrary` instead of `window.claude.complete`.

## Production notes

- **Never** expose `ANTHROPIC_API_KEY` to the client. All model calls go through `/api/ask`.
- **Rate limit / auth**: add your auth + a per-user rate limit to the route before shipping.
- **Streaming** (optional): swap `messages.create` for `messages.stream` and return a
  `ReadableStream`; the client reads it incrementally for token-by-token output.
- **Scaling retrieval**: the JSON index (~5 MB) loads fine per server instance. If you'd rather
  not ship a JSON blob, move retrieval into Postgres: create an `fm_sections` table
  (`fm_id, anchor, heading, crumb, body`) populated by `build-search-index.ts`, add a
  `tsvector` GIN index on `body`, and replace `retrieve()` with a `to_tsquery` SQL search.
  Same inputs/outputs — only the lookup changes.
