// reader.jsx — Direction A reader. window.ReaderView
(function () {
  const { useState, useEffect, useRef, useCallback } = React;

  window.ReaderView = function ReaderView({ fmId, anchor, onBack, bookmarked, onToggleBookmark, onOpenByNum, onAsk }) {
    const fm = window.FM_CATALOG.find(c => c.id === fmId);
    const [doc, setDoc] = useState(null);     // {meta, blocks, toc}
    const [err, setErr] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [progress, setProgress] = useState(0);
    const [tocOpen, setTocOpen] = useState(false);
    const artRef = useRef(null);
    const headOffsets = useRef([]);

    useEffect(() => {
      let alive = true;
      setDoc(null); setErr(null); setActiveId(null); setProgress(0);
      fetch("data/fm/" + encodeURIComponent(fm.file))
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(txt => {
          if (!alive) return;
          txt = txt.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
          setDoc(window.parseFM(txt, { title: fm.title, num: fm.num }));
        })
        .catch(e => alive && setErr(e.message));
      return () => { alive = false; };
    }, [fm.file]);

    // build heading offset table after render; wire cross-references; honor deep-link anchor
    useEffect(() => {
      if (!doc || !artRef.current) return;
      const root = artRef.current;
      const measure = () => {
        const els = [...root.querySelectorAll("[data-hid]")];
        headOffsets.current = els.map(el => ({ id: el.dataset.hid, top: el.offsetTop }));
        return els;
      };
      const goAnchor = () => {
        if (!anchor) return false;
        const target = root.querySelector('[data-hid="' + anchor + '"]');
        if (target) { root.scrollTop = target.offsetTop - 24; setActiveId(anchor); return true; }
        return false;
      };
      const els = measure();
      // make in-set cross-references clickable (once)
      const nums = new Set(window.FM_CATALOG.map(c => c.num));
      root.querySelectorAll(".xref").forEach(el => {
        const t = el.textContent.replace(/\u00a0/g, " ").trim();
        if (nums.has(t) && t !== fm.num) { el.classList.add("xref-live"); el.dataset.num = t; }
      });
      if (!goAnchor() && els.length) setActiveId(els[0].dataset.hid);
      // re-measure once fonts reflow the layout, so jumps stay accurate
      const reflow = () => { measure(); goAnchor(); };
      const t1 = setTimeout(reflow, 360);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(reflow);
      return () => clearTimeout(t1);
    }, [doc, anchor]);

    const onScroll = useCallback(() => {
      const el = artRef.current; if (!el) return;
      const st = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (st / max) * 100) : 0);
      const offs = headOffsets.current;
      let cur = offs.length ? offs[0].id : null;
      for (const o of offs) { if (o.top <= st + 120) cur = o.id; else break; }
      setActiveId(cur);
    }, []);

    const jump = (id) => {
      setTocOpen(false);
      const el = artRef.current; if (!el) return;
      const target = el.querySelector('[data-hid="' + id + '"]');
      if (target) el.scrollTop = target.offsetTop - 24;
    };

    const onArtClick = (e) => {
      const x = e.target.closest(".xref-live");
      if (x && x.dataset.num) onOpenByNum(x.dataset.num);
    };

    return (
      <div className="app">
        <div className="reader">
          <div className={"nav-backdrop" + (tocOpen ? " show" : "")} onClick={() => setTocOpen(false)} />
          {/* TOC */}
          <div className={"toc" + (tocOpen ? " open" : "")}>
            <div className="toc-head">
              <button className="backlink" onClick={onBack}>‹ Library</button>
              <div className="toc-num">{fm.num}</div>
              <div className="toc-title">{fm.title}</div>
            </div>
            <div className="toc-list scroll">
              <div className="toc-label">Contents</div>
              {!doc && !err && <div style={{ padding: "8px 10px", color: "var(--mute)", fontSize: 13 }}>Building contents…</div>}
              {doc && doc.toc.length === 0 && <div style={{ padding: "8px 10px", color: "var(--mute)", fontSize: 13 }}>No sections detected.</div>}
              {doc && doc.toc.map(t => (
                <button key={t.id}
                  className={"toc-item lvl" + t.level + (activeId === t.id ? " on" : "")}
                  onClick={() => jump(t.id)}>{t.text}</button>
              ))}
            </div>
          </div>

          {/* Document */}
          <div className="doc">
            <div className="doc-band">
              <div className="doc-band-top">
                <div className="band-left">
                  <button className="nav-toggle" onClick={() => setTocOpen(o => !o)}>☰ Contents</button>
                  <div>
                    <div className="doc-num">{fm.num}</div>
                    <div className="doc-title">{fm.title}</div>
                  </div>
                </div>
                <div className="doc-side">
                  <div className="doc-actions">
                    <button className="bm-btn" onClick={onAsk}>✦ Ask</button>
                    <button className={"bm-btn" + (bookmarked ? " on" : "")} onClick={onToggleBookmark}>
                      {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
                    </button>
                  </div>
                  <div className="doc-side-meta">
                    {(doc && doc.meta.date) || "—"}<br />
                    {fm.pages} pages<br />
                    {(fm.words / 1000).toFixed(0)}k words
                  </div>
                </div>
              </div>
              <div className="restrict"><span className="dot" />
                Distribution A — {(doc && doc.meta.restriction) || "Approved for public release"}</div>
              <div className="progress" style={{ width: progress + "%" }} />
            </div>

            <div className="article scroll" ref={artRef} onScroll={onScroll} onClick={onArtClick}>
              <div className="article-inner">
                {err && <div className="loading">Could not load {fm.file} ({err}).</div>}
                {!doc && !err && <div className="loading">Loading manual…</div>}
                {doc && <Body blocks={doc.blocks} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  function Body({ blocks }) {
    // group consecutive table rows into a table
    const out = [];
    let prevChap = false;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === "tr") {
        const rows = [];
        while (i < blocks.length && blocks[i].type === "tr") { rows.push(blocks[i]); i++; }
        i--;
        out.push(
          <div className="doc-table" key={"t" + i}>
            {rows.map((r, ri) => (
              <div className="row" key={ri}>
                {r.cells.map((c, ci) => <div className="cell" key={ci} dangerouslySetInnerHTML={{ __html: c }} />)}
              </div>
            ))}
          </div>
        );
        continue;
      }
      if (b.type === "fig") {
        prevChap = false;
        out.push(
          <div className={"a-fig " + b.kind} key={i}>
            <span className="a-fig-tag">{b.kind === "table" ? "▦" : "◐"} {b.label}</span>
            {b.text && <span className="a-fig-cap">{b.text}</span>}
            <span className="a-fig-note">{b.kind === "table" ? "Table" : "Figure"} reproduced in source PDF</span>
          </div>
        );
        continue;
      }
      if (b.type === "h") {
        if (b.chap) {
          out.push(<div key={i} className="a-chap" data-hid={b.id}>{b.text}</div>);
          prevChap = true;
          continue;
        }
        const Tag = b.level === 1 ? "h1" : b.level === 2 ? "h2" : "h3";
        let cls = b.level === 1 ? "a-h1" : b.level === 2 ? "a-h2" : "a-h3";
        let RenderTag = Tag;
        if (prevChap) { RenderTag = "h1"; cls = "a-h1 nob"; }  // title following a chapter label
        out.push(<RenderTag key={i} className={cls} data-hid={b.id}>{b.text}</RenderTag>);
        prevChap = false;
      } else if (b.type === "li") {
        prevChap = false;
        out.push(<div className="li" key={i} dangerouslySetInnerHTML={{ __html: b.html }} />);
      } else {
        prevChap = false;
        out.push(<p key={i} dangerouslySetInnerHTML={{ __html: b.html }} />);
      }
    }
    return out;
  }
})();
