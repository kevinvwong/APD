# Army Doctrine Assistant (APD) — User Guide

A complete guide to using the Army Doctrine Assistant: a full-text library and
AI research assistant for the U.S. Army's active Field Manuals (FMs), with an
optional curated reference library of organization & management theory.

> **In one line:** browse and read every active Field Manual, ask questions in
> plain English, and get answers cited to the exact section — then click
> straight to the source.

---

## Contents

1. [What APD is](#1-what-apd-is)
2. [Getting started](#2-getting-started)
3. [The catalog — browse & search](#3-the-catalog--browse--search)
4. [The reader — reading a manual](#4-the-reader--reading-a-manual)
5. [The Ask assistant](#5-the-ask-assistant)
6. [Your Library — saved work](#6-your-library--saved-work)
7. [Tips for better answers](#7-tips-for-better-answers)
8. [Privacy & your data](#8-privacy--your-data)
9. [FAQ & troubleshooting](#9-faq--troubleshooting)
10. [Glossary](#10-glossary)

---

## 1. What APD is

APD has three core capabilities:

| | What it does |
| --- | --- |
| **Browse** | A searchable catalog of all 51 active Field Manuals, sourced from [armypubs.army.mil](https://armypubs.army.mil). |
| **Read** | A clean, section-linked reader with a navigable table of contents, inline figures, and personal highlights. |
| **Ask** | An AI research assistant (powered by Claude) that answers doctrinal questions and **cites the exact FM section** behind every claim. |

Two kinds of source live in the library:

- **Field Manuals (doctrine)** — public-domain U.S. Army publications. Available to everyone.
- **Reference Library (books)** — curated organization & management theory works that complement the doctrine. These are **only visible to signed-in users**.

---

## 2. Getting started

### Browsing without an account

Anyone can visit the landing page. To open the catalog, read manuals, save
work, or use the assistant, you'll **sign in**.

### Creating an account / signing in

1. Click **Sign in** (top-right) or any **Get started** button.
2. A sign-in window appears. Create an account or sign in with an existing one.
3. Once signed in, you land on the **catalog**.

Your account unlocks: the full catalog, the reader, the Ask assistant, the
Reference Library, and your personal **Library** (saved threads, bookmarks,
highlights, and reading history).

---

## 3. The catalog — browse & search

The catalog is your home base once signed in. It lists every publication and
gives you several ways to find what you need.

### Search

Use the search box (top) to filter by **title** or **FM number** (e.g. type
`3-90`, `mission command`, or `intelligence`). Click **Clear ✕** to reset.

### Sort

Three sort chips:

- **By Number** — grouped into doctrinal series (see below).
- **A–Z** — alphabetical by title.
- **Largest** — biggest manuals first (by word count).

### The Browse rail (left)

The rail scopes the list to a slice of the library:

- **All Series** — everything.
- **★ Bookmarked** — manuals (and sections) you've starred.
- **◷ Recently Read** — what you've opened recently.
- **❧ Reference Library** — the curated books (org & management theory).
- **Doctrinal Series 1–7** — the FM numbering families:

| Series | Theme |
| --- | --- |
| 1 | Personnel & References |
| 2 | Intelligence |
| 3 | Operations, Fires & Maneuver |
| 4 | Sustainment |
| 5 | Planning |
| 6 | Mission Command & Signal |
| 7 | Training & Readiness |

On mobile, tap **☰ Browse** to open the rail.

### Reference Library

When the corpus includes curated books, they appear in their own **Reference
Library** section (and rail filter) rather than mixed in with the FM series. A
small **Book** badge marks them, and the author shows in place of an FM number.

### Bookmarks & "Continue Reading"

- Click the **☆ star** on any row to bookmark it (★ = bookmarked). Find these
  under **★ Bookmarked**.
- The **Continue Reading** shelf at the top surfaces manuals you've recently
  opened so you can jump back in.

### Opening a manual

Click any row to open it in the **reader**.

---

## 4. The reader — reading a manual

The reader renders a parsed, navigable version of the manual.

### Navigating

- **Table of contents** — jump to any chapter or section. The TOC follows the
  manual's real heading structure.
- **Deep links** — every section has a stable anchor, so links (including Ask
  citations and shared URLs) scroll you to the exact section.
- **Cross-references** — references to other FMs are clickable and take you to
  that manual.

### Figures & tables

Figures and tables referenced in the text are rendered inline as images where
available; click to view larger.

### Highlighting (signed-in)

1. **Select** any passage with your cursor (or finger).
2. A small toolbar appears with three colors — **gold**, **olive**, **red**.
3. Click a color to save the highlight. It's stored to your account and
   reappears whenever you reopen that manual.

Highlights are personal and private to you. Review them all in your
**Library → Highlights**.

### Ask about this manual

From a manual you can launch the assistant **scoped to that FM** — every answer
is drawn only from that manual's text. (See the next section.)

---

## 5. The Ask assistant

The assistant answers doctrinal questions and cites its sources. Open it from
**✦ Ask AI** in the catalog, or scoped to a manual from the reader.

### Asking a question

Type a plain-English question (e.g. *"What are the principles of mission
command?"*) and press **Enter** or **Ask**. The answer **streams in live**, and
a **Sources** list appears beneath it.

### Citations

Claims are tagged with numbered citations like `[1]`, `[2]`. Each number is a
button — click it (or the matching entry in the **Sources** list) to **jump to
that exact section** in the reader. This is the heart of APD: every statement is
traceable to doctrine.

### Answer mode — *where the answer comes from*

A toggle near the input controls how the assistant answers:

| Mode | Behavior | Use when |
| --- | --- | --- |
| **▤ Library only** | Answers **strictly** from indexed source excerpts; every claim is cited; says so if it can't find the answer. | You want grounded, citation-only answers with no outside knowledge. |
| **✦ Model + Library** | Claude may add its broader knowledge **on top of** the cited excerpts, clearly flagging anything beyond the sources. | You want context, synthesis, or background the manuals don't spell out. |

A disclaimer under the box reminds you which mode is active. Always verify
against the source manual for anything that matters.

### Search scope — *which corpus to search* (library-wide Ask only)

When asking across the whole library (not scoped to one FM), a **Search**
control lets you target a corpus:

- **All** — Field Manuals **and** the Reference Library.
- **Field Manuals** — doctrine only.
- **Reference** — the curated books only.

(The scope control is hidden when you've already scoped the assistant to a
single manual, since that's narrower still.)

### FM-scoped Ask

Launching Ask from inside a manual restricts every answer to **that manual's
text**. The header shows what you're scoped to. Great for "what does *this* FM
say about X" questions.

### Conversations & follow-ups

- The assistant remembers the **recent turns** of your conversation, so you can
  ask follow-ups naturally.
- When signed in, conversations are **saved automatically** and appear in your
  **Library**. The page URL updates so you can refresh or share a link back to
  the thread.
- **Clear** starts a fresh conversation.

### Starring answers

Click **☆ Star this answer** under any response to save it to
**Library → Starred**. Click again to unstar.

---

## 6. Your Library — saved work

**★ Your Library** (top-right) is your personal workspace. It collects:

| Section | What's there |
| --- | --- |
| **Conversations** | Every Ask thread you've had, newest first — reopen to continue. |
| **Bookmarks** | Manuals (and specific sections) you've starred. |
| **Recently read** | Your reading history. |
| **Highlights** | Every passage you've highlighted, with its color and source. |
| **Starred** | Individual assistant answers you've starred. |

Everything here is private to your account.

---

## 7. Tips for better answers

- **Use doctrinal terms.** "Forms of the defense" or "warfighting functions"
  retrieve better than vague paraphrases.
- **One idea per question.** Ask focused questions; use follow-ups to drill in.
- **Pick the right mode.** Need a citation you can trust? **Library only.**
  Need synthesis or background? **Model + Library.**
- **Scope it.** Researching one manual? Open it and use **FM-scoped Ask.**
  Comparing across doctrine? Use library-wide with **Field Manuals** scope.
- **Follow the citations.** The numbered links are the point — click through to
  read the source in context before relying on an answer.
- **Verify what matters.** The assistant is a research aid, not an authority.
  Confirm against the manual for anything consequential.

---

## 8. Privacy & your data

- **Your saved content** — conversations, bookmarks, highlights, reading
  history, and starred answers — is tied to your account and visible only to
  you.
- **Field Manuals** are public-domain U.S. Government publications.
- **Reference Library** books are only served to **signed-in** users (they're
  curated, in some cases non-public-domain, material).
- Questions you ask are sent to the AI provider (Anthropic Claude) to generate
  answers, along with the relevant source excerpts.

---

## 9. FAQ & troubleshooting

**Do I need an account?**
Yes, to read manuals, ask questions, or save work. The landing page is the only
page you can see signed out.

**Why does the assistant say it "couldn't find anything"?**
In **Library only** mode it answers strictly from indexed excerpts. If nothing
relevant matched, rephrase using doctrinal terms, or switch to **Model +
Library**.

**A citation didn't jump to the right place.**
Citations link to a section anchor. If a manual was re-indexed, an old shared
link may drift; reopen from the current Sources list.

**Can I see the Reference Library without signing in?**
No — those works are only available to signed-in users.

**Is the assistant always right?**
No. Treat it as a fast research aid and **verify against the cited manual**,
especially for anything you'll act on.

**The assistant briefly showed an error.**
Transient issues (e.g., rate limits) can cause a one-off "assistant
unavailable" message — try again in a moment.

---

## 10. Glossary

- **FM (Field Manual)** — a U.S. Army doctrinal publication (e.g. *FM 3-0,
  Operations*).
- **Doctrinal series** — the FM numbering families (1–7), each covering a
  theme.
- **Citation `[n]`** — a numbered, clickable reference linking a claim to the
  exact source section.
- **Library only / Model + Library** — the two answer modes (cited-excerpts-only
  vs. excerpts + Claude's broader knowledge).
- **Search scope** — which corpus the assistant searches: All, Field Manuals, or
  Reference.
- **Reference Library** — curated organization & management theory books that
  complement the doctrine (signed-in only).
- **Anchor / deep link** — a stable link to a specific section, used by
  citations and the reader.

---

*For setup, architecture, and contributor docs, see the
[README](../README.md) and [CONTRIBUTING](../CONTRIBUTING.md).*
