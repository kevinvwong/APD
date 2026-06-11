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

interface Props {
  fm: FmMeta;
  doc: ParsedFM;
  /** Map of fm_number string → fm id, for xref navigation */
  fmIndex: Record<string, number>;
}

export function ReaderClient({ fm, doc, fmIndex }: Props) {
  const router = useRouter();
  const [tocOpen, setTocOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const artRef = useRef<HTMLDivElement>(null);
  const headOffsets = useRef<{ id: string; top: number }[]>([]);

  // Estimated pages (250 words per page)
  const pages = Math.max(1, Math.ceil(fm.word_count / 250));

  // Load bookmark state from localStorage (client-only)
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("apd:bookmarks") || "[]");
      setBookmarked(Array.isArray(stored) && stored.includes(fm.id));
    } catch {
      // ignore
    }
  }, [fm.id]);

  // Build heading offset table, wire xrefs, handle anchor deep-link
  useEffect(() => {
    const root = artRef.current;
    if (!root) return;

    const measure = () => {
      const els = [...root.querySelectorAll<HTMLElement>("[data-hid]")];
      headOffsets.current = els.map((el) => ({
        id: el.dataset.hid!,
        top: el.offsetTop,
      }));
      return els;
    };

    const goAnchor = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return false;
      const target = root.querySelector<HTMLElement>(`[data-hid="${hash}"]`);
      if (target) {
        root.scrollTop = target.offsetTop - 24;
        setActiveId(hash);
        return true;
      }
      return false;
    };

    const els = measure();

    // Mark cross-references that match a known FM number
    root.querySelectorAll<HTMLElement>(".xref").forEach((el) => {
      const t = el.textContent?.replace(/ /g, " ").trim() ?? "";
      if (fmIndex[t] !== undefined && t !== fm.fm_number) {
        el.classList.add("xref-live");
        el.dataset.num = t;
      }
    });

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
  }, [doc, fm.fm_number, fmIndex]);

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
    if (target) el.scrollTop = target.offsetTop - 24;
  };

  const toggleBookmark = () => {
    setBookmarked((prev) => {
      const next = !prev;
      try {
        const stored: number[] = JSON.parse(
          localStorage.getItem("apd:bookmarks") || "[]",
        );
        const updated = next
          ? [...stored.filter((x) => x !== fm.id), fm.id]
          : stored.filter((x) => x !== fm.id);
        localStorage.setItem("apd:bookmarks", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const onArtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const x = target.closest<HTMLElement>(".xref-live");
    if (x?.dataset.num) {
      const targetId = fmIndex[x.dataset.num];
      if (targetId !== undefined) router.push(`/fm/${targetId}`);
    }
  };

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
                <div className="doc-num">{fm.fm_number}</div>
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
        >
          <div className="article-inner">
            <Body blocks={doc.blocks} />
          </div>
        </div>
      </div>
    </div>
  );
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
          <span className="a-fig-note">
            {b.kind === "table" ? "Table" : "Figure"} reproduced in source PDF
          </span>
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
