# Handoff: APD Doctrine Library

## Overview
A reading and research experience for the U.S. Army's library of ~51 active **Field Manuals (FMs)**. It replaces a bare raw‑markdown dump with three connected surfaces:

1. **Catalog** — browse/search all manuals, grouped by doctrinal series, with bookmarks, recently‑read, and a "Continue Reading" shelf.
2. **Reader** — renders a manual's real text as clean prose with a navigable table of contents, scroll‑spy, reading‑progress bar, clickable doctrinal cross‑references, and figure/table placeholders.
3. **Ask AI** — a retrieval‑augmented assistant that answers doctrinal questions with citations that deep‑link back to the exact section, with a **Library‑only vs Model+Library** grounding toggle.

The visual language is "Doctrine" — a paper‑and‑ink field‑manual aesthetic: warm paper background, olive‑drab command color, Oswald (display) + Source Serif 4 (body).

---

## About the Design Files
The files in `prototype/` are a **design reference created in HTML/CSS/React‑via‑Babel** — a working prototype that shows the intended look and behavior. They are **not** production code to ship as‑is. The task is to **recreate this design in the target codebase's environment**.

The target codebase here is already known: a **Next.js (App Router) + TypeScript + Tailwind + Drizzle/Postgres** app (the "APD" repo) whose `field_manuals` table holds each manual's `fm_number`, `title`, `filename`, `content` (raw markdown), and word count. Recreate the prototype as React Server/Client Components in that app, reading from the existing DB instead of the static JSON/JS data files used by the prototype.

The `production-ai/` folder already contains the production‑ready TypeScript port of the AI assistant (parser, retrieval, `/api/ask` route, client) — see its own README.

## Fidelity
**High‑fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified below and present in `prototype/doctrine.css`. Recreate the UI pixel‑for‑pixel using the codebase's stack (Tailwind + CSS variables). Where the prototype uses plain CSS classes, you may map them to Tailwind utilities or keep `doctrine.css` as a global stylesheet — the token values are what matter.

---

## Tech mapping (prototype → production)

| Prototype (in `prototype/`) | Role | Production target |
|---|---|---|
| `APD Doctrine Library.html` | Host page, loads React 18 UMD + Babel + scripts, Google Fonts | `app/layout.tsx` + route segments |
| `doctrine.css` | All styling + design tokens (`:root` vars) | Global stylesheet / Tailwind theme extension |
| `mock-data.js` | `window.FM_CATALOG` (51 manuals), `window.FM_SERIES` (7 series) | Replace with DB query of `field_manuals` |
| `data/catalog.json` | Same catalog as JSON | DB query |
| `data/fm/*.md` | Raw manual markdown (one sample included: FM 3‑0) | Existing `field_manuals.content` column |
| `reader-parse.js` | Tolerant FM‑markdown → blocks + TOC parser | `production-ai/src/lib/fm-parse.ts` (already ported to TS) |
| `search.js` | `window.FT` lazy full‑text section search | `production-ai/src/lib/retrieve.ts` (server) or client index |
| `search-index.json` | Prebuilt section index (~5.3 MB) | Built by `production-ai/scripts/build-search-index.ts` |
| `catalog.jsx` | `window.CatalogView` | `app/(catalog)/page.tsx` + client components |
| `reader.jsx` | `window.ReaderView` | `app/fm/[id]/page.tsx` |
| `ask.jsx` | `window.AskView` | `app/ask/page.tsx` + `/api/ask` |
| `app.jsx` | Hash router, bookmarks, recents (localStorage) | Next.js routing + localStorage hooks |

> **Note on React components:** the prototype shares components across `<script type="text/babel">` files by assigning them to `window` (`window.CatalogView`, `window.ReaderView`, `window.AskView`). In Next.js these become normal ES module imports.

---

## Design Tokens

All defined in `prototype/doctrine.css` under `:root`. Exact values:

### Colors
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#f4f1e8` | Page background (warm paper) |
| `--card` | `#fbf9f2` | Raised surfaces: masthead, rails, cards |
| `--ink` | `#1c1b16` | Primary text |
| `--ink-soft` | `#3a3527` | Secondary text, H3 |
| `--olive` | `#4a5524` | Command color: FM numbers, active states, document band |
| `--olive-d` | `#363f1a` | Darker olive: H2, group labels |
| `--olive-l` | `#5c692f` | Lighter olive accent |
| `--rule` | `#ddd6c4` | Hairline dividers |
| `--rule-d` | `#cdc4ad` | Stronger borders, scrollbar thumb |
| `--mute` | `#7d7660` | Muted/meta text, placeholders |
| `--red` | `#8a2b1f` | Reserved alert/restriction accent |
| `--gold` | `#c9a23a` | Progress bar, restriction dot |

### Typography
| Token | Stack | Use |
|---|---|---|
| `--head` | `'Oswald', system-ui, sans-serif` | All display: mastheads, FM numbers, headings, labels, buttons. Uppercase + letter‑spacing. |
| `--serif` | `'Source Serif 4', Georgia, serif` | Body prose, manual titles (italic), reader paragraphs |

Google Fonts import (in `<head>`): `Oswald:wght@400;500;600;700` and `Source Serif 4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400`.

Representative type ramp (see CSS for the complete set):
- Masthead title: Oswald 700, 27px, uppercase, `letter-spacing:.01em`
- FM row title: Source Serif 4, 17.5px, line‑height 1.25
- Reader body `p`: Source Serif 4, 17.5px, line‑height 1.65, `text-wrap:pretty`, 15px bottom margin
- Reader chapter title (`h1.a-h1`): Oswald 700, 30px, uppercase, 2px olive top border
- Reader H2 (`a-h2`): Oswald 600, 20px, uppercase, color `--olive-d`
- Section/eyebrow labels: Oswald 600, 11px, `letter-spacing:.16–.24em`, uppercase, color `--mute`

### Spacing, borders, misc
- Content measure (reader): `max-width:760px`, centered.
- Catalog left rail: `264px`; Reader TOC: `320px`; both `border-right:1px solid --rule`, background `--card`.
- Borders are square (no border radius anywhere — intentional, field‑manual feel). The only radius is the circular `.seal` (50%) and the round restriction `.dot`.
- Masthead bottom: `3px double var(--olive)`.
- Document band (reader header): solid `--olive` background, `--paper` text, padding `20px 56px 18px`.
- Progress bar: 3px, `--gold`, animates `width` `.15s`.
- Hover affordance on FM rows: background → `--card`, `padding-left` 8px→14px, chevron fades in (`.1s`).
- Custom thin scrollbars on `.scroll` (thumb `--rule-d`, 3px paper border).
- `::selection` background `--olive`, text `--paper`.

### Responsive breakpoints
- `max-width:1100px` → hide the catalog series rail; TOC narrows to 260px.
- `max-width:780px` → hide reader TOC and catalog rail; left navigation collapses into slide‑in drawers (toggled by a header button); reduce horizontal padding to ~20–24px.

---

## Screens / Views

### 1. Catalog (`catalog.jsx` → `window.CatalogView`)
**Purpose:** browse and find a manual.

**Layout:** vertical flex filling the viewport.
- **Masthead** (`.masthead`): circular olive `.seal` ("APD"), kicker "ARMY PUBLISHING DIRECTORATE", title "FIELD MANUAL LIBRARY", right‑aligned live count ("N of 51 publications", "Current as of June 2026"). `--card` bg, double‑olive bottom border.
- **Controls bar** (`.controls`): full‑width search input (`⌕` glyph, uppercase Oswald, 1.5px ink border, olive focus ring via `box-shadow`) + three sort chips ("By Number", "A–Z", "Largest"); active chip is olive‑filled.
- **Body** (`.cat-body`): two columns.
  - **Series rail** (`.rail`, 264px): "DOCTRINAL SERIES" header, "All Series" plus the 7 numbered series (1–7) each with name + count; active item has a 3px olive left border. Clicking filters; clicking active clears.
  - **Listing** (`.listing`): when sorted By Number, grouped with a `.group-h` header per series ("N00 SERIES" + name + rule line). Each `.fmrow` (anchor): FM number (Oswald 700, olive, 104px col), title (serif 17.5px), meta ("NN pp · Nk words", uppercase mute), and a hover chevron.
  - Plus (in the full prototype) a **Bookmarks** strip and **Continue Reading** shelf surfaced above the listing when present.
- **Empty state:** `.empty` — "No field manuals match "…"".

**Series map (`window.FM_SERIES`):** 1 Personnel & References · 2 Intelligence · 3 Operations, Fires & Maneuver · 4 Sustainment · 5 Planning · 6 Mission Command & Signal · 7 Training & Readiness.

### 2. Reader (`reader.jsx` → `window.ReaderView`)
**Purpose:** read a manual.

**Layout:** two columns (`.reader`).
- **TOC** (`.toc`, 320px): "‹ LIBRARY" back link, FM number (Oswald 700, 20px, olive), italic serif title, then a scrollable `.toc-list`. Level‑1 entries (chapters/appendices) are Oswald uppercase olive; level‑2 are indented serif. Active entry (scroll‑spy) gets an olive left border + paper bg. Clicking scrolls the article to that section.
- **Document** (`.doc`):
  - **Band** (`.doc-band`, olive): FM number + big uppercase title (Oswald 700, 34px); right side shows date / pages / word count; a `.restrict` chip ("DISTRIBUTION A — Approved for public release…", gold dot); a `.progress` gold bar pinned to the band's bottom edge tracking scroll.
  - **Article** (`.article`, scrollable, `max-width:760px` inner): the parsed manual. Block types rendered: chapter eyebrow (`.a-chap`, olive uppercase, top border), `h1.a-h1` (chapter title; `.nob` variant drops the border when it follows an eyebrow), `h2.a-h2`, `h3.a-h3`, `p`, `.li` (olive square bullet), `.doc-table` (bordered rows/cells), and figure/table placeholder cards. Inline doctrinal refs (FM/ADP/JP/ATP/AR/DA Form + number) are wrapped in `.xref` (Oswald, olive, non‑breaking) and are **clickable** → open that manual.
- **Header actions:** bookmark toggle (persists), "Ask AI about this manual" → opens Ask scoped to this FM.

**Loading/error:** `.loading` ("LOADING MANUAL…") while fetching; graceful "Could not load …" on fetch failure.

### 3. Ask AI (`ask.jsx` → `window.AskView`)
**Purpose:** answer doctrinal questions with cited sources.

**Layout:** a chat thread (`.ask-thread`) above a fixed input bar (`.ask-input`).
- **Thread:** alternating question blocks (`.q-block`) and answer cards. Answers render markdown and **clickable `[n]` citation badges** (`.cite`); below each answer a **Sources** list (`.source`, clickable → deep‑link to that FM section via `#/fm/:id/:anchor`). On a new question, the thread scrolls so the **latest question sits at the top** (so the answer reads from its start).
- **Input bar:** an "ANSWER FROM" segmented control (`.seg`) — **▤ Library only** (strict RAG; refuses if not in corpus; header "Sources") vs **✦ Model + Library** (Claude may add general knowledge, flags it, still cites; header "Related in library"). Selection persists in `localStorage` (`apd_ask_mode`). Below: textarea (auto‑grow) + "ASK ↵" button, and a disclaimer line that changes per mode.
- **Suggested questions** (`.sug`) shown on an empty thread.

**Retrieval:** `search.js` / `retrieve.ts` tokenizes the question (stopword‑filtered), scores sections (heading matches weighted 4×, body 1×, exact‑phrase bonus), optionally restricted to one FM, returns top 8. The prompt is built by `buildPrompt(question, sources, history, mode)`.

**Model call:** in the prototype this uses the preview runtime's built‑in `window.claude.complete` (no API key, sandbox‑only). **In production this is replaced by `POST /api/ask`** which calls Anthropic with a server‑side `ANTHROPIC_API_KEY`. See `production-ai/`.

---

## Interactions & Behavior
- **Routing (hash‑based in prototype, `app.jsx`):**
  - `#/` → Catalog
  - `#/fm/:id` → Reader; `#/fm/:id/:anchor` (e.g. `/h12`) → Reader scrolled to a section
  - `#/ask` → Ask (library‑wide); `#/ask/:id` → Ask scoped to FM `:id`
  - In Next.js: `/`, `/fm/[id]` (with `#anchor`), `/ask`.
- **Scroll‑spy:** reader computes heading offsets after render; the TOC highlights the section whose top is within ~120px of the scroll position; the gold progress bar = `scrollTop / (scrollHeight − clientHeight)`.
- **Cross‑reference click:** `.xref` → look up FM by number → navigate to it.
- **Bookmark toggle / recently‑read:** persisted in `localStorage` (`apd_bookmarks`, `apd_recents`, max 12), surfaced on the catalog.
- **Search:** live filtering in the catalog (number/title/proponent); full‑text passage search over `search-index.json` with highlighted matches, deep‑linking to the section.
- **Transitions:** FM row hover `.1s`; progress bar width `.15s`; chip/toggle color `.12s`. No large decorative animations.
- **Responsive:** rails/TOC collapse into slide‑in drawers under 780px (see breakpoints above).

## State Management
Prototype state (lift into React state / Next hooks):
- `route` `{ view, fmId, anchor }` — from the URL.
- `bookmarks: number[]`, `recents: number[]` — localStorage‑backed.
- Reader: `doc` (parsed `{meta, blocks, toc}`), `activeId` (scroll‑spy), `progress`.
- Ask: `messages[]` (`{role, text, sources?, mode?}`), `input`, `busy`, `phase`, `mode` (persisted).
- Data fetching: prototype fetches static files; production reads `field_manuals` from Postgres (catalog list + single manual `content`), runs `parseFM(content)` server‑side, and calls `/api/ask` for the assistant.

## Assets
- **Fonts:** Oswald + Source Serif 4 via Google Fonts (swap to `next/font` in production).
- **No image assets / no icon library** — glyphs are Unicode (`⌕ ‹ › ✕ ↵ ▤ ✦ ·`) and the "seal" is a CSS circle with "APD" text. No SVG illustrations.
- **Data:** the 51 manuals' markdown lives in the existing DB (`field_manuals.content`) and the user's local `APD/fm-md/` folder. Only **FM 3‑0** (`data/fm/ARN43326-FM_3-0-000-WEB-1.md`) is bundled here as a parser sample. `search-index.json` is the prebuilt section index (regenerate with the production script).

## Files
Everything needed to recreate the design is in **`prototype/`** (open `APD Doctrine Library.html` to run it — catalog + search work offline; the reader can only open the bundled FM 3‑0 sample, others need the full corpus). The production‑ready AI assistant port is in **`production-ai/`** (see its README).

### Screenshots (`screenshots/`)
Visual reference of the high‑fidelity target:
- `01-catalog.png` — Catalog: masthead, search + sort chips, "Continue Reading" shelf, series‑grouped manual rows.
- `02-reader.png` — Reader: TOC with scroll‑spy, olive document band (FM 3‑0 Operations), parsed prose with an inline `.xref` cross‑reference.
- `03-ask.png` — Ask AI empty state: research‑assistant intro, "Answer from" Library‑only / Model+Library toggle, input bar + disclaimer.
- `04-ask-answer.png` — Ask AI answered: question pinned to top, synthesized answer with bold key terms and a clickable `[1]` citation badge.

---

### Running the prototype locally
Because the JSX is compiled in‑browser by Babel and components are fetched as separate files, serve the folder over HTTP (don't open via `file://`):
```bash
cd prototype && python3 -m http.server 8000   # then visit http://localhost:8000/APD%20Doctrine%20Library.html
```
