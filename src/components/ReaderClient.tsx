"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, ParsedFM } from "@/lib/fm-parse";

// FM record without the heavy content field
export interface FmMeta {
  id: number;
  fm_number: string;
  title: string;
  word_count: number;
}

export interface Highlight {
  id: number;
  anchor: string;
  selected_text: string;
  color: string;
  note: string | null;
}

interface Props {
  fm: FmMeta;
  doc: ParsedFM;
  /** Map of fm_number string → fm id, for xref navigation */
  fmIndex: Record<string, number>;
  /** Highlights this user has previously saved on this manual */
  initialHighlights?: Highlight[];
}

type HighlightColor = "gold" | "olive" | "red";

interface ToolbarState {
  anchor: string;
  text: string;
  /** Pixel position relative to article container */
  top: number;
  left: number;
}

export function ReaderClient({
  fm,
  doc,
  fmIndex,
  initialHighlights = [],
}: Props) {
  const router = useRouter();
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const headOffsets = useRef<{ id: string; top: number }[]>([]);

  // Estimated pages (250 words per page)
  const pages = Math.max(1, Math.ceil(fm.word_count / 250));

  // Load bookmark state + record this manual as recently read
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("apd_bookmarks") || "[]");
      setBookmarked(Array.isArray(stored) && stored.includes(fm.id));
    } catch {
      // ignore
    }
    // Write to recently-read list (max 12, most recent first)
    try {
      const prev: number[] = JSON.parse(
        localStorage.getItem("apd_recents") || "[]",
      );
      const updated = [fm.id, ...prev.filter((x) => x !== fm.id)].slice(0, 12);
      localStorage.setItem("apd_recents", JSON.stringify(updated));
    } catch {
      // ignore
    }
    // Also sync to server if signed in (fire-and-forget; 401 is fine for anon)
    fetch("/api/library/recents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fm_id: fm.id }),
    }).catch(() => {});
  }, [fm.id]);

  // Build heading offset table, wire xrefs, handle anchor deep-link
  useEffect(() => {
    const root = artRef.current;
    if (!root) return;

    const measure = () => {
      const els = [...root.querySelectorAll<HTMLElement>("[data-hid]")];
      const containerTop = root.getBoundingClientRect().top;
      headOffsets.current = els.map((el) => ({
        id: el.dataset.hid!,
        // Store position relative to current scroll position so onScroll can compare against scrollTop
        top: el.getBoundingClientRect().top - containerTop + root.scrollTop,
      }));
      return els;
    };

    const goAnchor = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return false;
      const target = root.querySelector<HTMLElement>(`[data-hid="${hash}"]`);
      if (target) {
        const containerTop = root.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        root.scrollTop += targetTop - containerTop - 24;
        setActiveId(hash);
        return true;
      }
      return false;
    };

    const els = measure();

    // xref links are now rendered server-side as <a class="xref xref-live">
    // by parseFM with fmIndex — no client-side wiring needed.

    if (!goAnchor() && els.length) {
      setActiveId(els[0].dataset.hid ?? null);
    }

    // Re-measure after fonts reflow
    const reflow = () => {
      measure();
      goAnchor();
    };
    const t1 = setTimeout(reflow, 360);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(reflow);
    }
    return () => clearTimeout(t1);
  }, [doc, fm.fm_number]);

  const onScroll = useCallback(() => {
    const el = artRef.current;
    if (!el) return;
    const st = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, (st / max) * 100) : 0);
    const offs = headOffsets.current;
    let cur = offs.length ? offs[0].id : null;
    for (const o of offs) {
      if (o.top <= st + 120) cur = o.id;
      else break;
    }
    setActiveId(cur);
  }, []);

  const jump = (id: string) => {
    setTocOpen(false);
    const el = artRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-hid="${id}"]`);
    if (target) {
      // getBoundingClientRect is relative to viewport; adjust by the container's own rect
      const containerTop = el.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      el.scrollTop += targetTop - containerTop - 24;
      setActiveId(id);
    }
  };

  const toggleBookmark = () => {
    setBookmarked((prev) => {
      const next = !prev;
      try {
        const stored: number[] = JSON.parse(
          localStorage.getItem("apd_bookmarks") || "[]",
        );
        const updated = next
          ? [...stored.filter((x) => x !== fm.id), fm.id]
          : stored.filter((x) => x !== fm.id);
        localStorage.setItem("apd_bookmarks", JSON.stringify(updated));
      } catch {
        // ignore
      }
      // Sync to server (no-op for anon users; 401 is fine)
      if (next) {
        fetch("/api/library/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fm_id: fm.id }),
        }).catch(() => {});
      } else {
        fetch(`/api/library/bookmarks?fm_id=${fm.id}`, {
          method: "DELETE",
        }).catch(() => {});
      }
      return next;
    });
  };

  // Intercept clicks on server-rendered xref-live anchors for SPA navigation.
  const onArtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const a = target.closest<HTMLAnchorElement>("a.xref-live");
    if (a && a.getAttribute("href")?.startsWith("/fm/")) {
      e.preventDefault();
      router.push(a.getAttribute("href")!);
    }
  };

  // ─── Text selection → floating highlight toolbar ─────────────────────────
  // Detects a non-empty selection within the article. Finds the nearest
  // data-hid ancestor (section anchor) so the highlight survives across
  // re-renders, captures the selected text, and positions a toolbar.
  const onArtMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // If the user clicked inside the floating toolbar itself, ignore
    if ((e.target as HTMLElement).closest(".highlight-toolbar")) return;

    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) {
      setToolbar(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 4) {
      setToolbar(null);
      return;
    }

    const root = artRef.current;
    if (!root) return;
    const range = sel.getRangeAt(0);
    // Confirm the selection lives inside the article
    if (!root.contains(range.commonAncestorContainer)) return;

    // Find the nearest [data-hid] ancestor (section the selection lives in)
    let node: Node | null = range.commonAncestorContainer;
    let anchorEl: HTMLElement | null = null;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset && el.dataset.hid) {
          anchorEl = el;
          break;
        }
      }
      node = node.parentNode;
    }
    // Fall back to the most-recently-scrolled-past heading if no ancestor match
    const anchor = anchorEl?.dataset.hid ?? activeId ?? "";
    if (!anchor) return;

    // Position the toolbar above the selection rect, relative to the article
    const rect = range.getBoundingClientRect();
    const cRect = root.getBoundingClientRect();
    setToolbar({
      anchor,
      text,
      top: rect.top - cRect.top + root.scrollTop - 44,
      left: Math.max(
        8,
        rect.left + rect.width / 2 - cRect.left - 96, // 96 = half toolbar width
      ),
    });
  };

  async function saveHighlight(color: HighlightColor) {
    if (!toolbar) return;
    const text = toolbar.text.slice(0, 4000);
    const anchor = toolbar.anchor;
    setToolbar(null);
    if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
    try {
      const res = await fetch("/api/library/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fm_id: fm.id,
          anchor,
          selected_text: text,
          color,
        }),
      });
      if (res.status === 401) {
        // Not signed in — nudge to sign in
        // eslint-disable-next-line no-alert
        alert("Sign in to save highlights.");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setHighlights((prev) => [
        {
          id: data.id,
          anchor,
          selected_text: text,
          color,
          note: null,
        },
        ...prev,
      ]);
    } catch {
      // ignore
    }
  }

  // Render highlights — wrap matching text in <mark> after every render of the
  // article. Runs after each render where `highlights` or `doc` changed.
  useEffect(() => {
    const root = artRef.current;
    if (!root || highlights.length === 0) return;
    // Clear previously-injected marks first
    root.querySelectorAll<HTMLElement>("mark[data-hl]").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    // For each highlight, walk the matching section and wrap the first
    // text occurrence in a <mark>. Cheap and good enough for typical
    // highlight counts; not concerned with edge cases of overlapping ones.
    for (const h of highlights) {
      const section = root.querySelector<HTMLElement>(
        `[data-hid="${CSS.escape(h.anchor)}"]`,
      );
      // Walk subsequent siblings of the section heading until next data-hid
      const candidates: HTMLElement[] = [];
      if (section) {
        let n: Element | null = section.nextElementSibling;
        while (n && !(n as HTMLElement).dataset?.hid) {
          candidates.push(n as HTMLElement);
          n = n.nextElementSibling;
        }
        // Also include the section heading itself
        candidates.unshift(section);
      } else {
        // Fall back: scan whole article — rare path
        candidates.push(root);
      }

      for (const el of candidates) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let textNode: Node | null = walker.nextNode();
        while (textNode) {
          const value = textNode.nodeValue ?? "";
          const idx = value.indexOf(h.selected_text);
          if (idx >= 0) {
            const before = value.slice(0, idx);
            const matched = value.slice(idx, idx + h.selected_text.length);
            const after = value.slice(idx + h.selected_text.length);
            const mark = document.createElement("mark");
            mark.dataset.hl = String(h.id);
            mark.dataset.color = h.color;
            mark.textContent = matched;
            const parent = textNode.parentNode!;
            if (before)
              parent.insertBefore(document.createTextNode(before), textNode);
            parent.insertBefore(mark, textNode);
            if (after)
              parent.insertBefore(document.createTextNode(after), textNode);
            parent.removeChild(textNode);
            break;
          }
          textNode = walker.nextNode();
        }
      }
    }
  }, [highlights, doc]);

  const restriction =
    doc.meta.restriction ||
    "Approved for public release; distribution is unlimited.";

  return (
    <div className="reader">
      {/* Backdrop for mobile TOC */}
      <div
        className={"nav-backdrop" + (tocOpen ? " show" : "")}
        onClick={() => setTocOpen(false)}
      />

      {/* TOC panel */}
      <div className={"toc" + (tocOpen ? " open" : "")}>
        <div className="toc-head">
          <Link href="/" className="backlink">
            ‹ Library
          </Link>
          <div className="toc-num">{fm.fm_number}</div>
          <div className="toc-title">{fm.title}</div>
        </div>
        <div className="toc-list scroll">
          <div className="toc-label">Contents</div>
          {doc.toc.length === 0 && (
            <div
              style={{
                padding: "8px 10px",
                color: "var(--mute)",
                fontSize: 13,
              }}
            >
              No sections detected.
            </div>
          )}
          {doc.toc.map((t) => (
            <button
              key={t.id}
              className={
                "toc-item lvl" + t.level + (activeId === t.id ? " on" : "")
              }
              onClick={() => jump(t.id)}
            >
              {t.text}
            </button>
          ))}
        </div>
      </div>

      {/* Document */}
      <div className="doc">
        <div className="doc-band">
          <div className="doc-band-top">
            <div className="band-left">
              <button
                className="nav-toggle"
                onClick={() => setTocOpen((o) => !o)}
              >
                ☰ Contents
              </button>
              <div>
                <Link
                  href="/"
                  className="doc-num"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    opacity: 0.8,
                  }}
                >
                  ‹ {fm.fm_number}
                </Link>
                <div className="doc-title">{fm.title}</div>
              </div>
            </div>
            <div className="doc-side">
              <div className="doc-actions">
                <Link href={`/ask/${fm.id}`} className="bm-btn">
                  ✦ Ask
                </Link>
                <button
                  className={"bm-btn" + (bookmarked ? " on" : "")}
                  onClick={toggleBookmark}
                >
                  {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                </button>
              </div>
              <div className="doc-side-meta">
                {doc.meta.date || "—"}
                <br />
                {pages} pages
                <br />
                {(fm.word_count / 1000).toFixed(0)}k words
              </div>
            </div>
          </div>
          <div className="restrict">
            <span className="dot" />
            Distribution A — {restriction}
          </div>
          <div className="progress" style={{ width: progress + "%" }} />
        </div>

        <div
          className="article scroll"
          ref={artRef}
          onScroll={onScroll}
          onClick={onArtClick}
          onMouseUp={onArtMouseUp}
          style={{ position: "relative" }}
        >
          <div className="article-inner">
            <Body blocks={doc.blocks} />
          </div>
          {toolbar && (
            <div
              className="highlight-toolbar"
              style={{
                position: "absolute",
                top: toolbar.top,
                left: toolbar.left,
                zIndex: 40,
                background: "var(--ink)",
                color: "var(--paper)",
                padding: "6px 8px",
                borderRadius: 4,
                display: "flex",
                gap: 6,
                alignItems: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span
                style={{
                  fontFamily: "var(--head)",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  opacity: 0.8,
                  marginRight: 4,
                }}
              >
                Highlight
              </span>
              <button
                onClick={() => saveHighlight("gold")}
                aria-label="Highlight gold"
                style={swatchStyle("var(--gold)")}
              />
              <button
                onClick={() => saveHighlight("olive")}
                aria-label="Highlight olive"
                style={swatchStyle("var(--olive)")}
              />
              <button
                onClick={() => saveHighlight("red")}
                aria-label="Highlight red"
                style={swatchStyle("var(--red)")}
              />
              <button
                onClick={() => {
                  setToolbar(null);
                  window.getSelection()?.removeAllRanges();
                }}
                style={{
                  marginLeft: 4,
                  background: "transparent",
                  border: 0,
                  color: "var(--paper)",
                  cursor: "pointer",
                  fontSize: 14,
                  opacity: 0.7,
                }}
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function swatchStyle(bg: string): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: bg,
    border: "1.5px solid rgba(255,255,255,0.4)",
    cursor: "pointer",
    padding: 0,
  };
}

function Body({ blocks }: { blocks: Block[] }) {
  const out: React.ReactNode[] = [];
  let prevChap = false;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];

    if (b.type === "tr") {
      const rows: Extract<Block, { type: "tr" }>[] = [];
      while (i < blocks.length && blocks[i].type === "tr") {
        rows.push(blocks[i] as Extract<Block, { type: "tr" }>);
        i++;
      }
      i--;
      out.push(
        <div className="doc-table" key={"t" + i}>
          {rows.map((r, ri) => (
            <div className="row" key={ri}>
              {r.cells.map((c, ci) => (
                <div
                  className="cell"
                  key={ci}
                  dangerouslySetInnerHTML={{ __html: c }}
                />
              ))}
            </div>
          ))}
        </div>,
      );
      continue;
    }

    if (b.type === "fig") {
      prevChap = false;
      out.push(
        <div className={"a-fig " + b.kind} key={i}>
          <span className="a-fig-tag">
            {b.kind === "table" ? "▦" : "◐"} {b.label}
          </span>
          {b.text && <span className="a-fig-cap">{b.text}</span>}
          {b.url ? (
            <a
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="a-fig-img"
              aria-label={`Open ${b.label} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.url}
                alt={b.text || b.label}
                loading="lazy"
                decoding="async"
              />
            </a>
          ) : (
            <span className="a-fig-note">
              {b.kind === "table" ? "Table" : "Figure"} reproduced in source PDF
            </span>
          )}
        </div>,
      );
      continue;
    }

    if (b.type === "h") {
      if (b.chap) {
        out.push(
          <div key={i} className="a-chap" data-hid={b.id}>
            {b.text}
          </div>,
        );
        prevChap = true;
        continue;
      }

      const Tag = b.level === 1 ? "h1" : b.level === 2 ? "h2" : ("h3" as const);
      let cls = b.level === 1 ? "a-h1" : b.level === 2 ? "a-h2" : "a-h3";
      let RenderTag: "h1" | "h2" | "h3" = Tag;
      if (prevChap) {
        RenderTag = "h1";
        cls = "a-h1 nob";
      }
      out.push(
        <RenderTag key={i} className={cls} data-hid={b.id}>
          {b.text}
        </RenderTag>,
      );
      prevChap = false;
      continue;
    }

    prevChap = false;

    if (b.type === "li") {
      out.push(
        <div
          className="li"
          key={i}
          dangerouslySetInnerHTML={{ __html: b.html }}
        />,
      );
    } else {
      // b.type === "p"
      out.push(<p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />);
    }
  }

  return <>{out}</>;
}
