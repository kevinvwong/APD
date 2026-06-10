// app.jsx — shell: routing (+ section anchors), bookmarks, recently-read.
(function () {
  const { useState, useEffect, useCallback } = React;
  const BM_KEY = "apd_bookmarks", RC_KEY = "apd_recents";

  function readHash() {
    const a = location.hash.match(/^#\/ask(?:\/(\d+))?/);
    if (a) return { view: "ask", fmId: a[1] ? +a[1] : null, anchor: null };
    const m = location.hash.match(/^#\/fm\/(\d+)(?:\/(h\d+))?/);
    if (m) return { view: "reader", fmId: +m[1], anchor: m[2] || null };
    return { view: "catalog", fmId: null, anchor: null };
  }
  function loadArr(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } }

  function App() {
    const [route, setRoute] = useState(readHash);
    const [bookmarks, setBookmarks] = useState(() => loadArr(BM_KEY));
    const [recents, setRecents] = useState(() => loadArr(RC_KEY));

    useEffect(() => {
      const onHash = () => setRoute(readHash());
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, []);
    useEffect(() => { try { localStorage.setItem(BM_KEY, JSON.stringify(bookmarks)); } catch (e) {} }, [bookmarks]);
    useEffect(() => { try { localStorage.setItem(RC_KEY, JSON.stringify(recents)); } catch (e) {} }, [recents]);

    // record recently-read when a reader opens
    useEffect(() => {
      if (route.view === "reader" && route.fmId != null) {
        setRecents(prev => [route.fmId, ...prev.filter(x => x !== route.fmId)].slice(0, 12));
      }
    }, [route.view, route.fmId]);

    const open = useCallback((id) => { location.hash = "#/fm/" + id; }, []);
    const openAnchor = useCallback((id, hid) => { location.hash = "#/fm/" + id + (hid ? "/" + hid : ""); }, []);
    const openAsk = useCallback((id) => { location.hash = "#/ask" + (id ? "/" + id : ""); }, []);
    const openByNum = useCallback((num) => {
      const fm = window.FM_CATALOG.find(c => c.num === num);
      if (fm) location.hash = "#/fm/" + fm.id;
    }, []);
    const back = useCallback(() => { location.hash = ""; }, []);
    const toggleBookmark = useCallback((id) => {
      setBookmarks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev]);
    }, []);

    if (route.view === "ask") {
      return <window.AskView fmId={route.fmId} onBack={back} onOpenAnchor={openAnchor} />;
    }
    if (route.view === "reader" && route.fmId != null &&
        window.FM_CATALOG.some(c => c.id === route.fmId)) {
      return <window.ReaderView fmId={route.fmId} anchor={route.anchor} onBack={back}
        bookmarked={bookmarks.includes(route.fmId)}
        onToggleBookmark={() => toggleBookmark(route.fmId)}
        onOpenByNum={openByNum} onAsk={() => openAsk(route.fmId)} />;
    }
    return <window.CatalogView onOpen={open} onOpenAnchor={openAnchor} onAsk={() => openAsk(null)}
      bookmarks={bookmarks} recents={recents} onToggleBookmark={toggleBookmark} />;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
