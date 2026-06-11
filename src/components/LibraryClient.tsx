"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";

type ConvoRow = {
  id: number;
  fm_id: number | null;
  title: string;
  mode: string;
  updated_at: string | Date;
  message_count: number;
  fm_number: string | null;
  fm_title: string | null;
};
type BookmarkRow = {
  id: number;
  fm_id: number;
  anchor: string | null;
  note: string | null;
  created_at: string | Date;
  fm_number: string | null;
  fm_title: string | null;
};
type RecentRow = {
  fm_id: number;
  last_anchor: string | null;
  last_read_at: string | Date;
  fm_number: string | null;
  fm_title: string | null;
};
type HighlightRow = {
  id: number;
  fm_id: number;
  anchor: string;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string | Date;
  fm_number: string | null;
  fm_title: string | null;
};
type StarredRow = {
  id: number;
  conversation_id: number;
  text: string;
  created_at: string | Date;
  fm_id: number | null;
  fm_number: string | null;
  fm_title: string | null;
  conversation_title: string;
};

type Tab = "threads" | "bookmarks" | "highlights" | "starred" | "recents";

interface Props {
  conversations: ConvoRow[];
  bookmarks: BookmarkRow[];
  recents: RecentRow[];
  highlights: HighlightRow[];
  starred: StarredRow[];
}

function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LibraryClient({
  conversations,
  bookmarks,
  recents,
  highlights,
  starred,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    conversations.length ? "threads" : "bookmarks",
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "threads", label: "Threads", count: conversations.length },
    { key: "bookmarks", label: "Bookmarks", count: bookmarks.length },
    { key: "highlights", label: "Highlights", count: highlights.length },
    { key: "starred", label: "Starred", count: starred.length },
    { key: "recents", label: "Recently Read", count: recents.length },
  ];

  return (
    <div className="app">
      {/* Masthead */}
      <div className="masthead">
        <Link href="/" className="seal" style={{ textDecoration: "none" }}>
          APD
        </Link>
        <div style={{ flex: 1 }}>
          <div className="mast-kicker">Your Library</div>
          <div className="mast-title">Saved &amp; Bookmarked</div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
          }}
        >
          <Link href="/" className="backlink" style={{ marginBottom: 0 }}>
            ‹ Catalog
          </Link>
          <UserButton />
        </div>
      </div>

      {/* Tab bar */}
      <div className="controls" style={{ gap: 6 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={"chip" + (tab === t.key ? " on" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span
              style={{
                marginLeft: 8,
                opacity: 0.7,
                fontSize: "0.85em",
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="listing scroll">
        {tab === "threads" && <Threads rows={conversations} />}
        {tab === "bookmarks" && <Bookmarks rows={bookmarks} />}
        {tab === "highlights" && <Highlights rows={highlights} />}
        {tab === "starred" && <Starred rows={starred} />}
        {tab === "recents" && <Recents rows={recents} />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

function Threads({ rows }: { rows: ConvoRow[] }) {
  if (rows.length === 0)
    return (
      <Empty>
        No saved threads yet — ask the assistant anything while signed in.
      </Empty>
    );
  return (
    <div>
      {rows.map((c) => {
        const href = c.fm_id
          ? `/ask/${c.fm_id}?conversation=${c.id}`
          : `/ask?conversation=${c.id}`;
        return (
          <Link key={c.id} href={href} className="fmrow">
            <span className="fm-num">{c.fm_number ?? "ALL"}</span>
            <span className="fm-title">{c.title || "(untitled thread)"}</span>
            <span className="fm-meta">
              {c.message_count} msg · {fmtDate(c.updated_at)}
            </span>
            <span className="fm-chev">›</span>
          </Link>
        );
      })}
    </div>
  );
}

function Bookmarks({ rows }: { rows: BookmarkRow[] }) {
  if (rows.length === 0)
    return <Empty>No bookmarks yet — tap ★ on any manual to save it.</Empty>;
  return (
    <div>
      {rows.map((b) => (
        <Link
          key={b.id}
          href={b.anchor ? `/fm/${b.fm_id}#${b.anchor}` : `/fm/${b.fm_id}`}
          className="fmrow"
        >
          <span className="fm-num">{b.fm_number ?? "?"}</span>
          <span className="fm-title">
            {b.fm_title ?? "(unknown manual)"}
            {b.anchor && (
              <span
                style={{
                  marginLeft: 8,
                  fontFamily: "var(--head)",
                  fontSize: 12,
                  color: "var(--mute)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                · section {b.anchor}
              </span>
            )}
            {b.note && (
              <div
                style={{
                  fontSize: 14,
                  color: "var(--ink-soft)",
                  fontStyle: "italic",
                  marginTop: 2,
                }}
              >
                {b.note}
              </div>
            )}
          </span>
          <span className="fm-meta">{fmtDate(b.created_at)}</span>
          <span className="fm-chev">›</span>
        </Link>
      ))}
    </div>
  );
}

function Recents({ rows }: { rows: RecentRow[] }) {
  if (rows.length === 0)
    return <Empty>Nothing read yet — open any manual to get started.</Empty>;
  return (
    <div>
      {rows.map((r) => (
        <Link
          key={r.fm_id}
          href={
            r.last_anchor ? `/fm/${r.fm_id}#${r.last_anchor}` : `/fm/${r.fm_id}`
          }
          className="fmrow"
        >
          <span className="fm-num">{r.fm_number ?? "?"}</span>
          <span className="fm-title">{r.fm_title ?? "(unknown)"}</span>
          <span className="fm-meta">{fmtDate(r.last_read_at)}</span>
          <span className="fm-chev">›</span>
        </Link>
      ))}
    </div>
  );
}

function Highlights({ rows }: { rows: HighlightRow[] }) {
  if (rows.length === 0)
    return (
      <Empty>
        No highlights yet — select text in any manual to highlight it.
      </Empty>
    );
  return (
    <div>
      {rows.map((h) => (
        <Link
          key={h.id}
          href={`/fm/${h.fm_id}#${h.anchor}`}
          className="passage"
        >
          <div className="passage-top">
            <span className="passage-num">{h.fm_number ?? "?"}</span>
            <span className="passage-crumb">
              <b>{h.fm_title ?? "(unknown)"}</b>
              {" · "}
              {fmtDate(h.created_at)}
            </span>
          </div>
          <div
            className="passage-snip"
            style={{
              borderLeft: `3px solid var(--${h.color === "olive" ? "olive" : h.color === "red" ? "red" : "gold"})`,
              paddingLeft: 12,
            }}
          >
            {h.selected_text}
            {h.note && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  color: "var(--ink-soft)",
                  fontStyle: "italic",
                }}
              >
                — {h.note}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Starred({ rows }: { rows: StarredRow[] }) {
  if (rows.length === 0)
    return (
      <Empty>
        No starred answers — tap the ★ on any assistant answer to save it.
      </Empty>
    );
  return (
    <div>
      {rows.map((s) => {
        const href = s.fm_id
          ? `/ask/${s.fm_id}?conversation=${s.conversation_id}`
          : `/ask?conversation=${s.conversation_id}`;
        return (
          <Link key={s.id} href={href} className="passage">
            <div className="passage-top">
              <span className="passage-num">{s.fm_number ?? "ALL"}</span>
              <span className="passage-crumb">
                <b>{s.conversation_title || "(untitled)"}</b>
                {" · "}
                {fmtDate(s.created_at)}
              </span>
            </div>
            <div className="passage-snip">
              {s.text.slice(0, 400)}
              {s.text.length > 400 && "…"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
