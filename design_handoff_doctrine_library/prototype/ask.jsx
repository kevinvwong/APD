// ask.jsx — RAG assistant over the FM corpus. window.AskView
(function () {
  const { useState, useRef, useEffect } = React;

  const SUGGEST = [
    "What are the tenets of multidomain operations?",
    "How does Army doctrine define combat power?",
    "What is the role of a maneuver enhancement brigade?",
    "Summarize the characteristics of the defense.",
  ];

  function buildPrompt(question, sources, history, mode) {
    const ctx = sources.length
      ? sources.map((s, i) => `[${i + 1}] ${s.n} — ${s.ft}${s.c ? " > " + s.c : ""} > ${s.h}\n${s.b}`).join("\n\n")
      : "(no closely matching excerpts were found in the library)";
    const hist = history.length
      ? "Earlier in this conversation:\n" + history.map(m => (m.role === "user" ? "Q: " : "A: ") + m.text).join("\n") + "\n\n"
      : "";
    if (mode === "open") {
      return `You are a knowledgeable U.S. Army doctrine assistant with access to a library of official Field Manuals (FMs). ` +
        `Answer the QUESTION.\n` +
        `- You may draw on your own expertise in addition to the reference excerpts below.\n` +
        `- When a statement is directly supported by a provided excerpt, cite it with the excerpt number in brackets, e.g. [1].\n` +
        `- If you state something that goes beyond the provided excerpts, make clear it is general knowledge and may not match the exact manual wording.\n` +
        `- Be concise and authoritative.\n\n` +
        hist + `REFERENCE EXCERPTS (from the FM library; may be partial):\n${ctx}\n\nQUESTION: ${question}`;
    }
    return `You are a U.S. Army doctrine research assistant for a library of official Field Manuals (FMs). ` +
      `Answer the QUESTION using ONLY the numbered EXCERPTS below.\n` +
      `Rules:\n` +
      `- Cite every claim with excerpt number(s) in square brackets, e.g. [1] or [2,4].\n` +
      `- If the excerpts do not contain the answer, say you could not find it in the indexed manuals. Never invent doctrine or cite a manual that is not listed.\n` +
      `- Be concise and authoritative: one short paragraph or a few bullet points.\n\n` +
      hist + `EXCERPTS:\n${ctx}\n\nQUESTION: ${question}`;
  }

  // inline: **bold** + [n] citation badges
  function inlineNodes(text, sources, onOpenAnchor, kb) {
    const nodes = [];
    let last = 0, m;
    const re = /\*\*(.+?)\*\*|\[(\d+(?:\s*,\s*\d+)*)\]/g;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) nodes.push(text.slice(last, m.index));
      if (m[1] !== undefined) {
        nodes.push(<strong key={kb + "b" + m.index}>{m[1]}</strong>);
      } else {
        m[2].split(/\s*,\s*/).map(Number).forEach(n => {
          const s = sources[n - 1];
          nodes.push(<button key={kb + "c" + m.index + "_" + n} className="cite" disabled={!s}
            onClick={() => s && onOpenAnchor(s.f, s.a)} title={s ? s.n + " · " + s.h : ""}>{n}</button>);
        });
      }
      last = re.lastIndex;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }

  // render answer markdown (headings / bullets / paragraphs) with citations
  function Answer({ text, sources, onOpenAnchor }) {
    const lines = text.split("\n");
    const blocks = [];
    let para = [], list = [];
    const fp = () => { if (para.length) { blocks.push({ t: "p", text: para.join(" ") }); para = []; } };
    const fl = () => { if (list.length) { blocks.push({ t: "ul", items: list }); list = []; } };
    for (const ln of lines) {
      const s = ln.trim();
      if (!s) { fp(); fl(); continue; }
      const h = s.match(/^#{1,6}\s+(.*)/);
      if (h) { fp(); fl(); blocks.push({ t: "h", text: h[1] }); continue; }
      const b = s.match(/^(?:[-*•]|\d+\.)\s+(.*)/);
      if (b) { fp(); list.push(b[1]); continue; }
      fl(); para.push(s);
    }
    fp(); fl();
    return (
      <div className="ans-text">
        {blocks.map((bl, i) => bl.t === "h"
          ? <div key={i} className="ans-h">{inlineNodes(bl.text, sources, onOpenAnchor, i + "_")}</div>
          : bl.t === "ul"
            ? <ul key={i} className="ans-ul">{bl.items.map((it, j) =>
                <li key={j}>{inlineNodes(it, sources, onOpenAnchor, i + "_" + j + "_")}</li>)}</ul>
            : <p key={i}>{inlineNodes(bl.text, sources, onOpenAnchor, i + "_")}</p>)}
      </div>
    );
  }

  window.AskView = function AskView({ fmId, onBack, onOpenAnchor }) {
    const fm = fmId ? window.FM_CATALOG.find(c => c.id === fmId) : null;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [phase, setPhase] = useState("");
    const [mode, setMode] = useState(() => { try { return localStorage.getItem("apd_ask_mode") || "library"; } catch (e) { return "library"; } });
    const threadRef = useRef(null);
    const taRef = useRef(null);

    useEffect(() => { try { localStorage.setItem("apd_ask_mode", mode); } catch (e) {} }, [mode]);

    // bring the most recent question to the top of the thread so its answer reads from the start
    useEffect(() => {
      const thread = threadRef.current;
      if (!thread) return;
      const scrollLatestQ = () => {
        const qs = thread.querySelectorAll(".q-block");
        const lastQ = qs[qs.length - 1];
        if (!lastQ) return;
        const delta = lastQ.getBoundingClientRect().top - thread.getBoundingClientRect().top;
        thread.scrollTop += delta - 16;
      };
      scrollLatestQ();
      const t = setTimeout(scrollLatestQ, 60); // re-settle after answer/markdown lays out
      return () => clearTimeout(t);
    }, [messages, busy]);

    async function ask(q) {
      const question = (q || "").trim();
      if (!question || busy) return;
      const history = messages.slice(-4);
      setMessages(m => [...m, { role: "user", text: question }]);
      setInput("");
      setBusy(true);
      try {
        setPhase("Searching 51 manuals…");
        await window.FT.load();
        const sources = window.FT.retrieve(question, 8, fmId || null);
        if (!sources.length && mode === "library") {
          setMessages(m => [...m, { role: "assistant", text: "I couldn't find anything relevant in the indexed manuals for that. Try rephrasing with doctrinal terms — or switch to “Model + Library” to let me answer from general knowledge.", sources: [], mode }]);
          setBusy(false); setPhase(""); return;
        }
        setPhase(mode === "open" ? "Reasoning…" : "Consulting doctrine…");
        const prompt = buildPrompt(question, sources, history, mode);
        const answer = await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
        setMessages(m => [...m, { role: "assistant", text: answer, sources, mode }]);
      } catch (e) {
        setMessages(m => [...m, { role: "assistant", text: "⚠ The assistant is unavailable right now (" + (e && e.message ? e.message : "error") + "). This may be a rate limit — try again in a moment.", sources: [] }]);
      }
      setBusy(false); setPhase("");
    }

    const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } };

    return (
      <div className="app">
        <div className="ask-band">
          <button className="backlink" style={{ color: "var(--paper)", marginBottom: 8 }} onClick={onBack}>‹ Library</button>
          <div className="ask-band-title">Ask the Doctrine Library</div>
          <div className="ask-band-sub">
            {fm ? "Scoped to " + fm.num + " · " + fm.title
                : "Grounded answers drawn from 51 Field Manuals — every claim cites its source."}
          </div>
        </div>

        <div className="ask-thread scroll" ref={threadRef}>
          <div className="ask-inner">
            {messages.length === 0 && !busy && (
              <div className="ask-empty">
                <div className="seal" style={{ width: 54, height: 54, fontSize: 15 }}>APD</div>
                <div className="ask-empty-h">Research assistant</div>
                <div className="ask-empty-p">Ask a doctrinal question. Answers are synthesized only from the
                  {fm ? " text of " + fm.num : " indexed manuals"} and cite the exact sections — tap a citation to jump there.</div>
                <div className="ask-sugs">
                  {SUGGEST.map(s => <button key={s} className="sug" onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            )}

            {messages.map((m, i) => m.role === "user" ? (
              <div className="q-block" key={i}><span className="q-mark">Q</span><span className="q-text">{m.text}</span></div>
            ) : (
              <div className="a-block" key={i}>
                <Answer text={m.text} sources={m.sources} onOpenAnchor={onOpenAnchor} />
                {m.sources && m.sources.length > 0 && (
                  <div className="sources">
                    <div className="sources-h">{m.mode === "open" ? "Related in library" : "Sources"}</div>
                    {m.sources.map((s, idx) => (
                      <a key={idx} className="source" onClick={() => onOpenAnchor(s.f, s.a)}>
                        <span className="source-n">{idx + 1}</span>
                        <span className="source-num">{s.n}</span>
                        <span className="source-h">{s.c ? s.c + " › " : ""}{s.h}</span>
                        <span className="source-chev">›</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && <div className="a-block"><div className="thinking"><span className="dotpulse" />{phase}</div></div>}
          </div>
        </div>

        <div className="ask-input">
          <div className="ask-mode">
            <span className="ask-mode-label">Answer from</span>
            <div className="seg">
              <button className={mode === "library" ? "on" : ""} onClick={() => setMode("library")}>▤ Library only</button>
              <button className={mode === "open" ? "on" : ""} onClick={() => setMode("open")}>✦ Model + Library</button>
            </div>
          </div>
          <div className="ask-input-inner">
            <textarea ref={taRef} value={input} rows={1} onKeyDown={onKey}
              onChange={e => setInput(e.target.value)}
              placeholder={fm ? "Ask about " + fm.num + "…" : "Ask the doctrine library…"} />
            <button className="ask-send" disabled={busy || !input.trim()} onClick={() => ask(input)}>Ask ↵</button>
          </div>
          <div className="ask-disclaimer">
            {mode === "open"
              ? "May include general knowledge beyond the library — verify against the source manual"
              : "Answered only from indexed manual text — verify against the source manual"}
          </div>
        </div>
      </div>
    );
  };
})();
