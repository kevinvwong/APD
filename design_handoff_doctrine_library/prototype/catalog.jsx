// catalog.jsx — Direction A catalog: browse + full-text search + bookmarks/recents.
(function () {
  const { useState, useMemo, useRef, useEffect } = React;

  function Star({ on, onClick }) {
    return (
      <button className={"bm-star" + (on ? " on" : "")} title={on ? "Remove bookmark" : "Bookmark"}
        onClick={(e) => { e.stopPropagation(); onClick(); }}>{on ? "★" : "☆"}</button>
    );
  }

  function Highlight({ text, q }) {
    const snip = window.FT.snippet(text, q);
    return (
      <span>{snip.pre}{snip.hit && <mark>{snip.hit}</mark>}{snip.post}</span>
    );
  }

  window.CatalogView = function CatalogView({ onOpen, onOpenAnchor, onAsk, bookmarks, recents, onToggleBookmark }) {
    const cat = window.FM_CATALOG, series = window.FM_SERIES;
    const [q, setQ] = useState("");
    const [scope, setScope] = useState(0);   // 0=all | 'bm' | 'rc' | series number
    const [sort, setSort] = useState("number");
    const [ftTick, setFtTick] = useState(0);
    const [ftLoading, setFtLoading] = useState(false);
    const [railOpen, setRailOpen] = useState(false);
    const listRef = useRef(null);
    const bmSet = useMemo(() => new Set(bookmarks), [bookmarks]);
    const searching = q.trim().length >= 2;

    // lazy-load the full-text index when searching begins
    useEffect(() => {
      if (searching && !window.FT.ready()) {
        setFtLoading(true);
        window.FT.load().then(() => { setFtLoading(false); setFtTick(t => t + 1); });
      }
    }, [searching]);

    // ---- manual (title/number) matches, scoped ----
    const scopedManuals = useMemo(() => {
      let base;
      if (scope === "bm") base = bookmarks.map(id => cat.find(c => c.id === id)).filter(Boolean);
      else if (scope === "rc") base = recents.map(id => cat.find(c => c.id === id)).filter(Boolean);
      else if (typeof scope === "number" && scope > 0) base = cat.filter(c => c.series === scope);
      else base = cat;
      return base;
    }, [scope, bookmarks, recents, cat]);

    const manualMatches = useMemo(() => {
      const n = q.trim().toLowerCase();
      let r = scopedManuals.filter(c => !n ||
        c.num.toLowerCase().includes(n) || c.title.toLowerCase().includes(n) ||
        c.file.toLowerCase().includes(n) || c.seriesName.toLowerCase().includes(n));
      if (sort === "title") r = [...r].sort((a, b) => a.title.localeCompare(b.title));
      else if (sort === "size") r = [...r].sort((a, b) => b.words - a.words);
      return r;
    }, [q, scopedManuals, sort]);

    // ---- full-text passage matches ----
    const passages = useMemo(() => {
      if (!searching || !window.FT.ready()) return [];
      const allowed = (typeof scope === "number" && scope > 0) ? new Set([scope]) : null;
      return window.FT.searchPassages(q, allowed, 60);
    }, [q, scope, ftTick, searching]);

    const groups = useMemo(() => {
      if (sort !== "number" || scope === "bm" || scope === "rc")
        return [{ s: 0, name: null, items: manualMatches }];
      return Object.keys(series).map(k => ({
        s: +k, name: series[k], items: manualMatches.filter(c => c.series === +k)
      })).filter(g => g.items.length);
    }, [manualMatches, sort, scope, series]);

    const setScopeReset = (s) => { setScope(prev => prev === s ? 0 : s); setRailOpen(false); if (listRef.current) listRef.current.scrollTop = 0; };

    const Row = (it) => (
      <a key={it.id} className="fmrow" onClick={() => onOpen(it.id)}>
        <Star on={bmSet.has(it.id)} onClick={() => onToggleBookmark(it.id)} />
        <span className="fm-num">{it.num}</span>
        <span className="fm-title">{it.title}</span>
        <span className="fm-meta">{it.pages} pp · {(it.words / 1000).toFixed(0)}k words</span>
        <span className="fm-chev">›</span>
      </a>
    );

    const headerCount = searching
      ? manualMatches.length + " manuals · " + passages.length + " passages"
      : manualMatches.length + " of " + cat.length + " publications";

    return (
      <div className="app">
        <div className="masthead">
          <div className="seal">APD</div>
          <div style={{ flex: 1 }}>
            <div className="mast-kicker">Army Publishing Directorate</div>
            <div className="mast-title">Field Manual Library</div>
          </div>
          <div className="mast-meta">
            {headerCount}<br /><span style={{ color: "var(--olive)" }}>Current as of June 2026</span>
          </div>
        </div>

        <div className="controls">
          <div className="nav-toggle" onClick={() => setRailOpen(o => !o)}>☰ Browse</div>
          <div className="search">
            <span style={{ color: "var(--mute)" }}>⌕</span>
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search titles & full text of all 51 manuals…" autoFocus />
            {q && <span className="clear" onClick={() => setQ("")}>Clear ✕</span>}
          </div>
          {[["number", "By Number"], ["title", "A–Z"], ["size", "Largest"]].map(([k, label]) => (
            <div key={k} className={"chip" + (sort === k ? " on" : "")} onClick={() => setSort(k)}>{label}</div>
          ))}
          <div className="chip ask-chip" onClick={onAsk}>✦ Ask AI</div>
        </div>

        <div className="cat-body">
          <div className={"nav-backdrop" + (railOpen ? " show" : "")} onClick={() => setRailOpen(false)} />
          <div className={"rail scroll" + (railOpen ? " open" : "")}>
            <div className="rail-h">Library</div>
            <div className={"rail-item" + (scope === 0 ? " on" : "")} onClick={() => setScopeReset(0)}>
              <span className="rail-num">·</span><span className="rail-name">All Series</span>
              <span className="rail-count">{cat.length}</span>
            </div>
            <div className={"rail-item" + (scope === "bm" ? " on" : "")} onClick={() => setScopeReset("bm")}>
              <span className="rail-num" style={{ color: "var(--gold)" }}>★</span>
              <span className="rail-name">Bookmarked</span><span className="rail-count">{bookmarks.length}</span>
            </div>
            <div className={"rail-item" + (scope === "rc" ? " on" : "")} onClick={() => setScopeReset("rc")}>
              <span className="rail-num" style={{ fontSize: 14 }}>◷</span>
              <span className="rail-name">Recently Read</span><span className="rail-count">{recents.length}</span>
            </div>
            <div className="rail-h" style={{ paddingTop: 18 }}>Doctrinal Series</div>
            {Object.entries(series).map(([k, v]) => (
              <div key={k} className={"rail-item" + (scope === +k ? " on" : "")} onClick={() => setScopeReset(+k)}>
                <span className="rail-num">{k}</span><span className="rail-name">{v}</span>
                <span className="rail-count">{cat.filter(c => c.series === +k).length}</span>
              </div>
            ))}
          </div>

          <div className="listing scroll" ref={listRef}>
            {/* Continue reading shelf */}
            {!searching && scope === 0 && recents.length > 0 && (
              <div className="shelf">
                <div className="group-h"><span className="group-series">Continue Reading</span><span className="group-rule" /></div>
                <div className="shelf-row">
                  {recents.slice(0, 6).map(id => {
                    const it = cat.find(c => c.id === id); if (!it) return null;
                    return (
                      <div key={id} className="shelf-card" onClick={() => onOpen(id)}>
                        <div className="shelf-num">{it.num}</div>
                        <div className="shelf-title">{it.title}</div>
                        <div className="shelf-resume">Resume ›</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Browse / manual matches */}
            {(!searching || manualMatches.length > 0) && (
              <React.Fragment>
                {searching && <div className="group-h"><span className="group-series">Manuals</span>
                  <span className="group-name">{manualMatches.length} match{manualMatches.length === 1 ? "" : "es"}</span><span className="group-rule" /></div>}
                {groups.map(g => (
                  <div key={g.s}>
                    {g.name && <div className="group-h"><span className="group-series">{g.s}00 Series</span>
                      <span className="group-name">{g.name}</span><span className="group-rule" /></div>}
                    {g.items.map(Row)}
                  </div>
                ))}
              </React.Fragment>
            )}

            {!searching && manualMatches.length === 0 &&
              <div className="empty">{scope === "bm" ? "No bookmarks yet — tap ☆ on any manual." : scope === "rc" ? "Nothing read yet." : "Nothing here."}</div>}

            {/* Full-text passages */}
            {searching && (
              <div style={{ marginTop: 30 }}>
                <div className="group-h">
                  <span className="group-series">Inside Manuals</span>
                  <span className="group-name">{ftLoading ? "indexing…" : passages.length + " passage" + (passages.length === 1 ? "" : "s")}</span>
                  <span className="group-rule" />
                </div>
                {ftLoading && <div className="empty" style={{ padding: "30px 8px" }}>Building full-text index…</div>}
                {!ftLoading && passages.length === 0 && manualMatches.length === 0 &&
                  <div className="empty" style={{ padding: "30px 8px" }}>No results for “{q}”.</div>}
                {passages.map((p, i) => (
                  <a key={i} className="passage" onClick={() => onOpenAnchor(p.s.f, p.s.a)}>
                    <div className="passage-top">
                      <span className="passage-num">{p.s.n}</span>
                      <span className="passage-crumb">{p.s.c ? p.s.c + " ›" : ""} <b>{p.s.h}</b></span>
                    </div>
                    <div className="passage-snip"><Highlight text={p.s.b} q={q} /></div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
})();
