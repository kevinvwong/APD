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
  // Local copies so delete/remove controls can update the UI without a reload.
  const [convoList, setConvoList] = useState<ConvoRow[]>(conversations);
  const [bookmarkList, setBookmarkList] = useState<BookmarkRow[]>(bookmarks);
  const [highlightList, setHighlightList] = useState<HighlightRow[]>(highlights);
  const [starredList, setStarredList] = useState<StarredRow[]>(starred);

  const [tab, setTab] = useState<Tab>(
    conversations.length ? "threads" : "bookmarks",
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "threads", label: "Threads", count: convoList.length },
    { key: "bookmarks", label: "Bookmarks", count: bookmarkList.length },
    { key: "highlights", label: "Highlights", count: highlightList.length },
    { key: "starred", label: "Starred", count: starredList.length },
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
        {tab === "threads" && (
          <Threads rows={convoList} setRows={setConvoList} />
        )}
        {tab === "bookmarks" && (
          <Bookmarks rows={bookmarkList} setRows={setBookmarkList} />
        )}
        {tab === "highlights" && (
          <Highlights rows={highlightList} setRows={setHighlightList} />
        )}
        {tab === "starred" && (
          <Starred rows={starredList} setRows={setStarredList} />
        )}
        {tab === "recents" && <Recents rows={recents} />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Small inline delete/remove control placed at the end of a library row.
 *  Stops the click from bubbling to the surrounding navigation link. */
function RowAction({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        border: 0,
        background: "none",
        cursor: busy ? "default" : "pointer",
        fontFamily: "var(--head)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--mute)",
        padding: "4px 6px",
        flexShrink: 0,
        opacity: busy ? 0.5 : 1,
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!busy) e.currentTarget.style.color = "var(--red)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--mute)";
      }}
    >
      {label}
    </button>
  );
}

function Threads({
  rows,
  setRows,
}: {
  rows: ConvoRow[];
  setRows: React.Dispatch<React.SetStateAction<ConvoRow[]>>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function remove(id: number) {
    if (busyId !== null) return;
    if (!confirm("Delete this thread? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/library/conversations?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Couldn't delete that thread. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

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
          <div key={c.id} className="fmrow">
            <Link
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                flex: 1,
                textDecoration: "none",
                color: "inherit",
                minWidth: 0,
              }}
            >
              <span className="fm-num">{c.fm_number ?? "ALL"}</span>
              <span className="fm-title">
                {c.title || "(untitled thread)"}
              </span>
              <span className="fm-meta">
                {c.message_count} msg · {fmtDate(c.updated_at)}
              </span>
            </Link>
            <RowAction
              label="Delete"
              busy={busyId === c.id}
              onClick={() => remove(c.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

function Bookmarks({
  rows,
  setRows,
}: {
  rows: BookmarkRow[];
  setRows: React.Dispatch<React.SetStateAction<BookmarkRow[]>>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function remove(b: BookmarkRow) {
    if (busyId !== null) return;
    setBusyId(b.id);
    try {
      const qs = new URLSearchParams({ fm_id: String(b.fm_id) });
      if (b.anchor) qs.set("anchor", b.anchor);
      const res = await fetch(`/api/library/bookmarks?${qs.toString()}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((x) => x.id !== b.id));
    } catch {
      alert("Couldn't remove that bookmark. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0)
    return <Empty>No bookmarks yet — tap ★ on any manual to save it.</Empty>;
  return (
    <div>
      {rows.map((b) => (
        <div key={b.id} className="fmrow">
          <Link
            href={b.anchor ? `/fm/${b.fm_id}#${b.anchor}` : `/fm/${b.fm_id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              flex: 1,
              textDecoration: "none",
              color: "inherit",
              minWidth: 0,
            }}
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
          </Link>
          <RowAction
            label="Remove"
            busy={busyId === b.id}
            onClick={() => remove(b)}
          />
        </div>
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

function Highlights({
  rows,
  setRows,
}: {
  rows: HighlightRow[];
  setRows: React.Dispatch<React.SetStateAction<HighlightRow[]>>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function remove(id: number) {
    if (busyId !== null) return;
    if (!confirm("Delete this highlight?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/library/highlights?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setRows((prev) => prev.filter((h) => h.id !== id));
    } catch {
      alert("Couldn't delete that highlight. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0)
    return (
      <Empty>
        No highlights yet — select text in any manual to highlight it.
      </Empty>
    );
  return (
    <div>
      {rows.map((h) => (
        <div
          key={h.id}
          className="passage"
        >
          <div
            className="passage-top"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span className="passage-num">{h.fm_number ?? "?"}</span>
            <span className="passage-crumb">
              <b>{h.fm_title ?? "(unknown)"}</b>
              {" · "}
              {fmtDate(h.created_at)}
            </span>
            <span style={{ marginLeft: "auto" }}>
              <RowAction
                label="Delete"
                busy={busyId === h.id}
                onClick={() => remove(h.id)}
              />
            </span>
          </div>
          <Link
            href={`/fm/${h.fm_id}#${h.anchor}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
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
        </div>
      ))}
    </div>
  );
}

function Starred({
  rows,
  setRows,
}: {
  rows: StarredRow[];
  setRows: React.Dispatch<React.SetStateAction<StarredRow[]>>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  async function unstar(id: number) {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/library/starred`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: id, starred: false }),
      });
      if (!res.ok) throw new Error("unstar failed");
      setRows((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Couldn't unstar that answer. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

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
          <div key={s.id} className="passage">
            <div
              className="passage-top"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span className="passage-num">{s.fm_number ?? "ALL"}</span>
              <span className="passage-crumb">
                <b>{s.conversation_title || "(untitled)"}</b>
                {" · "}
                {fmtDate(s.created_at)}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <RowAction
                  label="Unstar"
                  busy={busyId === s.id}
                  onClick={() => unstar(s.id)}
                />
              </span>
            </div>
            <Link
              href={href}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="passage-snip">
                {s.text.slice(0, 400)}
                {s.text.length > 400 && "…"}
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
