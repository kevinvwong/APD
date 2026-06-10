// search.js — lazy full-text section search over search-index.json. window.FT
(function () {
  let cache = null, loading = null;

  function load() {
    if (cache) return Promise.resolve(cache);
    if (loading) return loading;
    loading = fetch("search-index.json")
      .then(r => r.json())
      .then(idx => { cache = idx; return idx; });
    return loading;
  }

  // returns ranked passage matches
  function searchPassages(q, allowedSeries, limit) {
    if (!cache) return [];
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out = [];
    for (let i = 0; i < cache.length; i++) {
      const s = cache[i];
      if (allowedSeries && !allowedSeries.has(seriesOf(s.n))) continue;
      const hMatch = s.h.toLowerCase().indexOf(needle);
      const cMatch = s.c ? s.c.toLowerCase().indexOf(needle) : -1;
      const bMatch = s.b.toLowerCase().indexOf(needle);
      if (hMatch < 0 && cMatch < 0 && bMatch < 0) continue;
      let score = 0;
      if (hMatch >= 0) score += 120 - Math.min(hMatch, 40);
      if (cMatch >= 0) score += 30;
      if (bMatch >= 0) score += 14 - Math.min(bMatch / 80, 12);
      out.push({ s, score, bMatch });
      if (out.length > 4000) break;
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit || 50);
  }

  function seriesOf(num) {
    const m = num.replace(/^FM\s+/, "").match(/^\d+/);
    return m ? +m[0] : 0;
  }

  const STOP = new Set(("the a an and or of to in for on with is are be as at by from this that these those it its "
    + "what how why when where which who does do can will should would could may might army units use used using "
    + "i we you they he she them about into over under between during within without than then there here").split(" "));

  function terms(q) {
    return (q.toLowerCase().match(/[a-z0-9][a-z0-9.\-]+/g) || [])
      .filter(w => w.length >= 3 && !STOP.has(w));
  }

  // retrieve top-k relevant sections for a natural-language question (for the assistant)
  function retrieve(question, k, restrictFm) {
    if (!cache) return [];
    const ts = terms(question);
    if (!ts.length) return [];
    const phrase = question.trim().toLowerCase();
    const scored = [];
    for (let i = 0; i < cache.length; i++) {
      const s = cache[i];
      if (restrictFm && s.f !== restrictFm) continue;
      const hay = (s.h + " " + s.c + " " + s.b).toLowerCase();
      let score = 0, hits = 0;
      for (const t of ts) {
        const inH = (s.h.toLowerCase().indexOf(t) >= 0) || (s.c && s.c.toLowerCase().indexOf(t) >= 0);
        const inB = s.b.toLowerCase().indexOf(t) >= 0;
        if (inH) { score += 4; hits++; }
        else if (inB) { score += 1; hits++; }
      }
      if (!hits) continue;
      score += hits * 1.5;                       // reward breadth of term coverage
      if (phrase.length > 8 && hay.indexOf(phrase) >= 0) score += 8;
      scored.push({ s, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k || 8).map(x => x.s);
  }

  window.FT = { load, searchPassages, snippet, retrieve, terms, ready: () => !!cache };

  // build a snippet around the first body match (original case)
  function snippet(text, q) {
    const needle = q.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(needle);
    if (idx < 0) return { pre: (text.length > 200 ? text.slice(0, 200) + "…" : text), hit: "", post: "" };
    const start = Math.max(0, idx - 55);
    return {
      pre: (start > 0 ? "…" : "") + text.slice(start, idx),
      hit: text.slice(idx, idx + needle.length),
      post: text.slice(idx + needle.length, idx + needle.length + 130) + "…"
    };
  }

  window.FT = { load, searchPassages, snippet, retrieve, terms, ready: () => !!cache };
})();
