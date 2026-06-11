"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import { SeriesRail, SERIES_MAP, type Scope } from "./SeriesRail";

// ---- Types ----

export interface FmRow {
  id: number;
  fm_number: string;
  title: string;
  word_count: number;
}

type SortKey = "number" | "title" | "size";

// ---- Helpers ----

/** Derive series number (1–7) from FM number string e.g. "FM 3-0" → 3 */
function deriveSeries(fm_number: string): number {
  const m = fm_number.match(/^FM\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function derivePages(word_count: number): number {
  return Math.round(word_count / 250);
}

// ---- useLocalStorage hook (SSR-safe) ----

function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      }
    } catch {
      // ignore
    }
  }, [key]);

  const set = useCallback(
    (val: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof val === "function" ? (val as (p: T) => T)(prev) : val;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}

// ---- Star Button ----

function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      className={"bm-star" + (on ? " on" : "")}
      title={on ? "Remove bookmark" : "Bookmark"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}

// ---- Main Component ----

interface CatalogClientProps {
  fms: FmRow[];
}

export function CatalogClient({ fms }: CatalogClientProps) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>(0);
  const [sort, setSort] = useState<SortKey>("number");
  const [railOpen, setRailOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [bookmarks, setBookmarks] = useLocalStorage<number[]>(
    "apd_bookmarks",
    [],
  );
  const [recents] = useLocalStorage<number[]>("apd_recents", []);

  // Enrich FMs with derived data
  const enriched = useMemo(
    () =>
      fms.map((fm) => ({
        ...fm,
        series: deriveSeries(fm.fm_number),
        pages: derivePages(fm.word_count),
        seriesName: SERIES_MAP[deriveSeries(fm.fm_number)] ?? "Other",
      })),
    [fms],
  );

  const bmSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  // Series counts for the rail
  const seriesCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const fm of enriched) {
      if (fm.series > 0) {
        counts[fm.series] = (counts[fm.series] ?? 0) + 1;
      }
    }
    return counts;
  }, [enriched]);

  // Scoped FM list based on rail selection
  const scopedFms = useMemo(() => {
    if (scope === "bm")
      return bookmarks
        .map((id) => enriched.find((f) => f.id === id))
        .filter(Boolean) as typeof enriched;
    if (scope === "rc")
      return recents
        .map((id) => enriched.find((f) => f.id === id))
        .filter(Boolean) as typeof enriched;
    if (typeof scope === "number" && scope > 0)
      return enriched.filter((f) => f.series === scope);
    return enriched;
  }, [scope, bookmarks, recents, enriched]);

  // Client-side search (title + fm_number only per task spec)
  const searching = q.trim().length >= 2;

  const manualMatches = useMemo(() => {
    const n = q.trim().toLowerCase();
    let r = scopedFms.filter(
      (f) =>
        !n ||
        f.fm_number.toLowerCase().includes(n) ||
        f.title.toLowerCase().includes(n) ||
        f.seriesName.toLowerCase().includes(n),
    );
    if (sort === "title")
      r = [...r].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "size")
      r = [...r].sort((a, b) => b.word_count - a.word_count);
    return r;
  }, [q, scopedFms, sort]);

  // Groups for number sort (series headers)
  const groups = useMemo(() => {
    if (sort !== "number" || scope === "bm" || scope === "rc") {
      return [{ s: 0, name: null, items: manualMatches }];
    }
    return Object.keys(SERIES_MAP)
      .map((k) => {
        const num = Number(k);
        return {
          s: num,
          name: SERIES_MAP[num],
          items: manualMatches.filter((f) => f.series === num),
        };
      })
      .filter((g) => g.items.length);
  }, [manualMatches, sort, scope]);

  // Scope setter that also resets rail drawer and scroll position
  const setScopeReset = useCallback((s: Scope) => {
    setScope((prev) => (prev === s ? 0 : s));
    setRailOpen(false);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, []);

  // Toggle bookmark
  const toggleBookmark = useCallback(
    (id: number) => {
      setBookmarks((prev) =>
        prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
      );
    },
    [setBookmarks],
  );

  const headerCount = searching
    ? `${manualMatches.length} manual${manualMatches.length === 1 ? "" : "s"}`
    : `${manualMatches.length} of ${fms.length} publications`;

  const recentItems = useMemo(
    () =>
      recents
        .slice(0, 6)
        .map((id) => enriched.find((f) => f.id === id))
        .filter(Boolean) as typeof enriched,
    [recents, enriched],
  );

  return (
    <div className="app">
      {/* ---- Masthead ---- */}
      <div className="masthead">
        <Link href="/" className="seal" style={{ textDecoration: "none" }}>
          APD
        </Link>
        <div style={{ flex: 1 }}>
          <div className="mast-kicker">Army Publishing Directorate</div>
          <div className="mast-title">Field Manual Library</div>
        </div>
        <div className="mast-meta">
          {headerCount}
          <br />
          <span style={{ color: "var(--olive)" }}>Current as of June 2026</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginLeft: 16,
          }}
        >
          <AuthSlot />
        </div>
      </div>

      {/* ---- Controls ---- */}
      <div className="controls">
        <div className="nav-toggle" onClick={() => setRailOpen((o) => !o)}>
          ☰ Browse
        </div>

        <div className="search">
          <span style={{ color: "var(--mute)" }}>⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or FM number…"
            autoFocus
          />
          {q && (
            <span className="clear" onClick={() => setQ("")}>
              Clear ✕
            </span>
          )}
        </div>

        {(
          [
            ["number", "By Number"],
            ["title", "A–Z"],
            ["size", "Largest"],
          ] as [SortKey, string][]
        ).map(([k, label]) => (
          <div
            key={k}
            className={"chip" + (sort === k ? " on" : "")}
            onClick={() => setSort(k)}
          >
            {label}
          </div>
        ))}

        <Link href="/ask" className={"chip ask-chip"}>
          ✦ Ask AI
        </Link>
      </div>

      {/* ---- Body ---- */}
      <div className="cat-body">
        {/* Backdrop for mobile rail drawer */}
        <div
          className={"nav-backdrop" + (railOpen ? " show" : "")}
          onClick={() => setRailOpen(false)}
        />

        {/* Series Rail */}
        <SeriesRail
          scope={scope}
          totalCount={fms.length}
          bookmarkCount={bookmarks.length}
          recentCount={recents.length}
          seriesCounts={seriesCounts}
          railOpen={railOpen}
          onSetScope={setScopeReset}
        />

        {/* Listing */}
        <div className="listing scroll" ref={listRef}>
          {/* Continue Reading shelf */}
          {!searching && scope === 0 && recentItems.length > 0 && (
            <div className="shelf">
              <div className="group-h">
                <span className="group-series">Continue Reading</span>
                <span className="group-rule" />
              </div>
              <div className="shelf-row">
                {recentItems.map((it) => (
                  <Link
                    key={it.id}
                    href={`/fm/${it.id}`}
                    className="shelf-card"
                  >
                    <div className="shelf-num">{it.fm_number}</div>
                    <div className="shelf-title">{it.title}</div>
                    <div className="shelf-resume">Resume ›</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Browse / manual matches */}
          {(!searching || manualMatches.length > 0) && (
            <>
              {searching && (
                <div className="group-h">
                  <span className="group-series">Manuals</span>
                  <span className="group-name">
                    {manualMatches.length} match
                    {manualMatches.length === 1 ? "" : "es"}
                  </span>
                  <span className="group-rule" />
                </div>
              )}

              {groups.map((g) => (
                <div key={g.s}>
                  {g.name && (
                    <div className="group-h">
                      <span className="group-series">{g.s}00 Series</span>
                      <span className="group-name">{g.name}</span>
                      <span className="group-rule" />
                    </div>
                  )}
                  {g.items.map((it) => (
                    <Link key={it.id} href={`/fm/${it.id}`} className="fmrow">
                      <Star
                        on={bmSet.has(it.id)}
                        onClick={() => toggleBookmark(it.id)}
                      />
                      <span className="fm-num">{it.fm_number}</span>
                      <span className="fm-title">{it.title}</span>
                      <span className="fm-meta">
                        {it.pages} pp · {(it.word_count / 1000).toFixed(0)}k
                        words
                      </span>
                      <span className="fm-chev">›</span>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* Empty state */}
          {!searching && manualMatches.length === 0 && (
            <div className="empty">
              {scope === "bm"
                ? "No bookmarks yet — tap ☆ on any manual."
                : scope === "rc"
                  ? "Nothing read yet."
                  : "Nothing here."}
            </div>
          )}

          {/* No results when searching */}
          {searching && manualMatches.length === 0 && (
            <div className="empty" style={{ padding: "30px 8px" }}>
              No results for &ldquo;{q}&rdquo;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthSlot() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className="chip" style={{ background: "transparent" }}>
          Sign in
        </button>
      </SignInButton>
    );
  }
  return (
    <>
      <Link
        href="/library"
        className="chip"
        style={{ background: "transparent", textDecoration: "none" }}
      >
        ★ Your Library
      </Link>
      <UserButton />
    </>
  );
}
