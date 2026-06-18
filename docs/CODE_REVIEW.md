# APD code review — 2026-06-17

Scope: full read of `src/`, `scripts/`, `drizzle/`, root config, and CI. Focus on correctness, security/auth, retrieval pipeline, schema/migrations, and client/script hygiene. No source files were modified.

## Summary

The codebase is in good shape for v0.2: the API surface validates input carefully, every mutating endpoint joins user ownership into its `WHERE`, secrets stay server-side, SQL is parameterized everywhere, and `withApiError` keeps internals out of error responses. CI runs typecheck + lint + tests + index validation + build on every PR.

The highest-leverage things to fix are (1) the JSON-fallback heuristic in `/api/ask` that silently masks a broken `pg`/`hybrid` backend, (2) the FM seed script that will either fail or wipe user data on any non-empty database, and (3) two unbounded bulk-insert paths in the library API. After that, there's a sizable cluster of low-severity cleanups (dead 401 guards behind middleware, naming debt from the `field_manuals → sources` rename, no direct unit tests for the 592-line FM parser).

## Findings

### 1. `/api/ask` JSON-fallback masks a broken pg/hybrid backend [Severity: med] [Area: retrieval]

**Where:** `src/app/api/ask/route.ts:54-71`

**What:** When `RETRIEVE_BACKEND` is `pg` or `hybrid`, the route falls back to the JSON backend not just on a thrown error but also whenever the chosen backend returns zero rows — `if (out.length) return out;` otherwise warn and fall through. A perfectly valid "no hits for this query" outcome is indistinguishable from "table missing / empty / pgvector unconfigured."

**Why it matters:** In production this can silently downgrade the configured retrieval path forever after a botched migration or a misconfigured embeddings provider, while the operator sees "Ask is working." Recall, latency, and cost characteristics all change without an alert. The `console.warn` is the only signal.

**Suggested fix:** Distinguish the cases. Only fall back on a thrown error or on a sentinel (e.g. row count < small probe query against `fm_sections`). Otherwise, return the empty result and let the existing `mode === "library"` no-results path serve the canned fallback message. At minimum, emit a structured warning the first time a fallback happens per cold start, not on every empty query.

---

### 2. `db:seed` will fail (or cascade-destroy user data) on any populated database [Severity: med] [Area: scripts/schema]

**Where:** `src/db/seed.ts:56`

**What:** `TRUNCATE sources RESTART IDENTITY` runs unconditionally and without `CASCADE`. `user_bookmarks`, `user_recents`, `user_highlights`, and `conversations` all hold FKs to `sources.id`, so once a single user has saved anything, the TRUNCATE will fail outright. Worse, `RESTART IDENTITY` reassigns FM ids; if anyone later "fixes" the script by adding `CASCADE`, every user's bookmarks/highlights/recents get cascade-deleted (and any survivors point at the wrong manual).

**Why it matters:** The script is documented in the README as the canonical setup step (`npm run db:seed`). In a real deployment with users, running it is destructive in a way that isn't telegraphed.

**Suggested fix:** Switch to per-row upsert on the `filename` unique index (same pattern as `scripts/ingest-book.ts:69-96`). Skip the TRUNCATE entirely; the existing rows keep their ids, and only changed content updates. If a hard reset is ever needed, gate it behind an explicit `--reset` flag and document the user-data consequences.

---

### 3. Bulk migration endpoints accept unbounded `ids` arrays [Severity: med] [Area: api]

**Where:** `src/app/api/library/bookmarks/route.ts:51-63`, `src/app/api/library/recents/route.ts:46-58`

**What:** Both POST handlers accept `{ ids: [number, ...] }` for the localStorage → DB migration on first sign-in. The array is filtered for positive integers but has no length cap, and every id is sent as an `INSERT … ON CONFLICT DO NOTHING` in a single statement.

**Why it matters:** A signed-in user (the migration is gated by auth) can ship an arbitrarily large JSON body and force a many-row INSERT against Neon. Not an external DoS, but a noisy-neighbor / accidental-foot-gun surface; a forged body with a million synthesized FM ids would also exhaust connection time and likely trip FK violations row-by-row.

**Suggested fix:** Cap at e.g. 100 ids per request, return 400 above that. Optionally, validate ids against `sources` first (single `SELECT id FROM sources WHERE id = ANY(...)`) before the INSERT so a single bad id doesn't fail the whole batch.

---

### 4. Stream errors arrive after partial deltas; client discards the partial answer [Severity: low] [Area: api/ui]

**Where:** `src/app/api/ask/route.ts:291-295`, `src/lib/ask-client.ts:93-95`, `src/components/AskPageClient.tsx:434-449`

**What:** If `anthropic.messages.create` or its iterator throws after the first `delta` events have been emitted, the route sends a final `{type:"error"}` and closes the stream. `ask-client.ts` then throws inside its event loop. `AskPageClient`'s catch replaces the in-progress assistant bubble with the generic "unavailable" message — silently discarding however much answer the user just watched stream in.

**Why it matters:** Mid-answer failures (transient rate limit, network blip) feel like the whole answer evaporated. The streaming UX advertises low-latency partial output but the partial is thrown away on failure.

**Suggested fix:** On `{type:"error"}`, surface the error as a banner appended to the existing assistant bubble (keep the partial text in place) rather than overwriting. Alternatively, have `ask-client.ts` resolve with the partial answer and an `error` field, and let `AskPageClient` decide presentation.

---

### 5. `withApiError` flattens all thrown errors to HTTP 500 [Severity: low] [Area: api]

**Where:** `src/lib/api-error.ts:9-21`

**What:** Every catch path returns `{ error: "Server error." }` with status 500. The route-level `/api/ask` handler (`route.ts:306-312`) does the right thing — it preserves 429 from the Anthropic SDK and maps 401 to 503 — but every library route loses that nuance and reports 500 even for things like a Neon rate limit (429) or a request-too-large condition.

**Why it matters:** Clients can't distinguish "back off and retry" from "permanent failure"; observability is coarser than it needs to be. Status-code semantics still matter for retries, dashboards, and end-user messaging.

**Suggested fix:** Inspect the error before responding: pass through `e?.status` (or `e?.code === "23505"` → 409 conflict, etc.) when the error carries a stable signal; default to 500 otherwise.

---

### 6. Redundant `if (!userId) return 401` in every library route [Severity: low] [Area: api]

**Where:** all 7 handlers under `src/app/api/library/**/route.ts` (e.g. `bookmarks/route.ts:20`, `highlights/route.ts:21`, `conversations/route.ts:17`, `conversations/[id]/route.ts:18`, `recents/route.ts:17`, `starred/route.ts:19`, etc.)

**What:** `src/middleware.ts:13-28` already short-circuits any unauthenticated `/api/*` request with a 401 JSON before it ever reaches a route handler. The per-route `userId` guard is dead code — but it's also load-bearing for type narrowing of `userId` from `string | null` to `string`, so removing it isn't free.

**Why it matters:** Future readers can't tell whether middleware or the handler is authoritative. If middleware is ever loosened (e.g. to allow anonymous Ask), every route silently changes behavior.

**Suggested fix:** Either drop the guards and assert non-null (`const { userId } = await auth(); // middleware guarantees a user`), with a comment pointing at the matcher in `middleware.ts`. Or, if the handlers should be defense-in-depth, extract a single helper (`async function requireUser(): Promise<string>`) so the pattern lives in one place.

---

### 7. `field_manuals → sources` rename leaves `fm_id` columns everywhere [Severity: low] [Area: schema]

**Where:** `src/db/schema.ts:62, 96, 139, 161, 180`; all library API handlers; `/fm/[id]` URL

**What:** The corpus table was renamed `sources` in `drizzle/0001_sources_generalize.sql`, but every FK column on user-data tables still uses the legacy name `fm_id` ("now meaning 'source id'", per the comment at `schema.ts:26-27`). The URL `/fm/[id]` also keeps the old name. The result is code that reads `fm_id` everywhere but is actually referring to a book half the time.

**Why it matters:** Naming debt. A new contributor reading `userBookmarks.fm_id` against a `book` source will have to dig to figure out whether bookmarks-on-books are supported (they are). Same for the `/fm/[id]` reader that also renders books.

**Suggested fix:** When you're ready to take a small breaking change: rename the columns to `source_id` in a follow-up migration (the FK indices already exist, so the rename is mechanical), and add a `/source/[id]` route that aliases `/fm/[id]` (or vice-versa). Not urgent; document the convention in `schema.ts` more prominently if deferring.

---

### 8. `fm-parse.ts` has zero direct unit tests [Severity: low] [Area: tests]

**Where:** `src/lib/fm-parse.ts` (592 LoC); test glob `src/lib/*.test.ts`

**What:** The parser handles a long list of fragile heuristics — chapter-page footer triplets, signature blocks, rank lines, distribution warnings, leader-line bullets, roman-numeral filters — many of which were the source of the 0.1.0 "Fixed" entries in CHANGELOG. There are unit tests for retrieve / rank-fusion / eval-metrics / book-convert / check-index-fresh, but nothing exercises `parseFM()` directly.

**Why it matters:** A regression in `fm-parse.ts` would corrupt the search index for all 51 FMs on the next `npm run search:index`. The blast radius is large and the CI signal is weak (typecheck + build don't catch parser drift).

**Suggested fix:** Add `src/lib/fm-parse.test.ts` with a handful of short golden-output fixtures — at minimum one per CHANGELOG'd fix (debris guard, leader-line, roman numerals, asterisk pairing, anchor stability). Even ~20 lines per case gives meaningful regression protection.

---

### 9. `retrieve.ts` index cache never invalidates [Severity: low] [Area: retrieval]

**Where:** `src/lib/retrieve.ts:20-27`

**What:** `CACHE` is module-scoped and only filled on first call; there's no invalidation. In a serverless runtime (Vercel functions, which is the documented deployment target) this is correct — the process is short-lived anyway. In `next dev` it means a fresh `search-index.json` from `npm run search:index` won't be visible until the dev server restarts.

**Why it matters:** Developer surprise during content iteration. Not a production issue.

**Suggested fix:** Optional. Watch the file's mtime and reload on change, or document the restart-on-reindex behavior in CONTRIBUTING.md.

---

### 10. `ingest-book.ts --access public` accepts copyrighted material without warning [Severity: low] [Area: scripts]

**Where:** `scripts/ingest-book.ts:48`

**What:** The default access level for books is `private` (correct — copyrighted material), but `--access public` is honored verbatim. There's no confirmation prompt, no flag-level warning, and the README's copyright note is the only reminder.

**Why it matters:** Easy to typo, easy to misremember. Once a book is `public`, anonymous users can retrieve it via the JSON path.

**Suggested fix:** If `--access public` is passed for `source_type === "book"`, print a loud warning and require an explicit `--confirm-public` flag. Or just refuse the combination; books are private by design.

---

### 11. `retrieve-hybrid.ts` vector literal isn't defensive against NaN/Infinity [Severity: low] [Area: retrieval]

**Where:** `src/lib/retrieve-hybrid.ts:50`

**What:** `const vecLiteral = \`[${queryVec.join(",")}]\`;` — if the embeddings provider ever returns a NaN or Infinity (driver bug, malformed response), the resulting `[1,NaN,3]::vector` cast will throw at the SQL layer.

**Why it matters:** Untrusted-by-paranoid input from a third-party API reaches the DB. Today this just becomes a 500 → JSON fallback; not a vulnerability, but a sharp edge.

**Suggested fix:** Validate the vector before serialising: reject if any entry isn't a finite number. Surface a clear error so it's debuggable.

---

### 12. `package.json` pins unusual TypeScript and @types/node versions [Severity: low] [Area: deps]

**Where:** `package.json:30, 46`

**What:** `"typescript": "^6.0.3"` and `"@types/node": "^25.9.2"` are well ahead of the typical "current stable" range (TypeScript 5.x is mainstream; @types/node tracks the LTS line, currently 22.x). CI runs Node 22 (`.github/workflows/ci.yml:18`), so the type defs are out of step with the runtime.

**Why it matters:** Confusing dependency surface for contributors; can cause `tsc --noEmit` to flag built-in API shapes that don't exist in the runtime Node version.

**Suggested fix:** Align `@types/node` with the CI Node version (`^22.x`). If TypeScript 6 is intentional (early adopter), leave a one-line note in CONTRIBUTING.md.

---

## Cleanup opportunities (low-severity, non-bug)

- `src/app/api/library/conversations/route.ts:46-48` — POST validates `fm_id` only as integer; doesn't bound it to `0 < n <= MAX_FM_ID` like `/api/ask` does (`route.ts:79, 123`). Mirror the same validation.
- `src/lib/ask-client.ts:108-113` — if the response body ends without a trailing newline, the tail is parsed once at the end; if the tail is empty whitespace it's skipped. Tested via `retrieve.test.ts`? No — add a parser test for chunk boundaries.
- `src/components/ReaderClient.tsx:69-92` — bookmarks/recents are written to **both** localStorage and the server. The localStorage path is dead for signed-in users and a footgun for anonymous (they can never read `/fm/[id]` because middleware blocks it). Drop the localStorage branch.
- `src/components/AskPageClient.tsx:24-85` — the `SUGGEST_FM` table is hand-maintained, with 10 FMs hardcoded out of 51. Either drive from a single config file or fall through to the generic suggestions for all of them.
- `src/db/seed.ts:38-48` — `parseTitleFromContent` walks lines and short-circuits on multiple heuristics; works but tangled. Consider extracting and adding a fixture-based test.
- `scripts/migrate.ts:13-14` — note "not exercised against a live DB in this worktree"; the WebSocket Pool path is now load-bearing for deploys. Worth a smoke test in CI against an ephemeral Neon branch.
- `src/middleware.ts:31-35` — the asset-exclusion regex hardcodes a long file-extension allowlist. Consider switching to "include only `/api/**` and `/`-prefixed routes that aren't `_next`" — easier to audit, harder to accidentally widen.
- `src/app/api/library/starred/route.ts:84-90` — the `updated_at` touch uses a correlated subquery against `messages`; a join would be both clearer and equally fast.
- `src/lib/retrieve.ts:29-35` — the stopword set is hand-tuned and lowercase. Document the source/rationale in a comment; otherwise it's a magic constant.
- `CHANGELOG.md:7-25` — the `[Unreleased]` block is large enough to be a `0.2.0` release on its own. Cut a tag once these findings are triaged.

## Not reviewed / out of scope

- The actual contents of `fm-md/` (51 markdown files) and any specific parsing accuracy regressions.
- `download_fms.py`, `pdf_to_md.py`, `scripts/extract-figures.py` — Python utility scripts; not run.
- `design_handoff_doctrine_library/` — design assets, not code.
- `eval/retrieval-gold.json` — the gold set for retrieval evaluation; trusted as-is.
- End-to-end behavior in a browser (no live Neon / Anthropic / Clerk credentials in this environment). All findings are static-analysis only — none have been reproduced against a running stack.
