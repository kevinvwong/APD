"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  askLibrary,
  type AskResult,
  type AskMode,
  type AskSource,
  type ChatTurn,
} from "@/lib/ask-client";

const SUGGEST = [
  "What are the tenets of multidomain operations?",
  "How does Army doctrine define combat power?",
  "What is the role of a maneuver enhancement brigade?",
  "Summarize the characteristics of the defense.",
];

interface FmInfo {
  id: number;
  fm_number: string;
  title: string;
}

interface Props {
  fmId: number | null;
  fm?: FmInfo;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: AskSource[];
  mode?: AskMode;
}

// inline: **bold** + [n] citation badges
function inlineNodes(
  text: string,
  sources: AskSource[],
  onCiteClick: (fmId: number, anchor: string) => void,
  kb: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  const re = /\*\*(.+?)\*\*|\[(\d+(?:\s*,\s*\d+)*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={kb + "b" + m.index}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      m[2]
        .split(/\s*,\s*/)
        .map(Number)
        .forEach((n) => {
          const s = sources[n - 1];
          nodes.push(
            <button
              key={kb + "c" + m!.index + "_" + n}
              className="cite"
              disabled={!s}
              onClick={() => s && onCiteClick(s.f, s.a)}
              title={s ? s.n + " · " + s.h : ""}
            >
              {n}
            </button>,
          );
        });
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// Render answer markdown (headings / bullets / paragraphs) with citations
function Answer({
  text,
  sources,
  onCiteClick,
}: {
  text: string;
  sources: AskSource[];
  onCiteClick: (fmId: number, anchor: string) => void;
}) {
  const lines = text.split("\n");
  type Block =
    | { t: "p"; text: string }
    | { t: "ul"; items: string[] }
    | { t: "h"; text: string };
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const fp = () => {
    if (para.length) {
      blocks.push({ t: "p", text: para.join(" ") });
      para = [];
    }
  };
  const fl = () => {
    if (list.length) {
      blocks.push({ t: "ul", items: list });
      list = [];
    }
  };
  for (const ln of lines) {
    const s = ln.trim();
    if (!s) {
      fp();
      fl();
      continue;
    }
    const hMatch = s.match(/^#{1,6}\s+(.*)/);
    if (hMatch) {
      fp();
      fl();
      blocks.push({ t: "h", text: hMatch[1] });
      continue;
    }
    const bMatch = s.match(/^(?:[-*•]|\d+\.)\s+(.*)/);
    if (bMatch) {
      fp();
      list.push(bMatch[1]);
      continue;
    }
    fl();
    para.push(s);
  }
  fp();
  fl();

  return (
    <div className="ans-text">
      {blocks.map((bl, i) =>
        bl.t === "h" ? (
          <div key={i} className="ans-h">
            {inlineNodes(bl.text, sources, onCiteClick, i + "_")}
          </div>
        ) : bl.t === "ul" ? (
          <ul key={i} className="ans-ul">
            {bl.items.map((it, j) => (
              <li key={j}>
                {inlineNodes(it, sources, onCiteClick, i + "_" + j + "_")}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inlineNodes(bl.text, sources, onCiteClick, i + "_")}</p>
        ),
      )}
    </div>
  );
}

export function AskPageClient({ fmId, fm }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [mode, setMode] = useState<AskMode>(() => {
    try {
      return (localStorage.getItem("apd_ask_mode") as AskMode) || "library";
    } catch {
      return "library";
    }
  });
  const threadRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist mode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("apd_ask_mode", mode);
    } catch {}
  }, [mode]);

  // Scroll so the latest .q-block is at top of thread (16px offset)
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const scrollLatestQ = () => {
      const qs = thread.querySelectorAll<HTMLElement>(".q-block");
      const lastQ = qs[qs.length - 1];
      if (!lastQ) return;
      const delta =
        lastQ.getBoundingClientRect().top - thread.getBoundingClientRect().top;
      thread.scrollTop += delta - 16;
    };
    scrollLatestQ();
    const t = setTimeout(scrollLatestQ, 60);
    return () => clearTimeout(t);
  }, [messages, busy]);

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const onCiteClick = (fId: number, anchor: string) => {
    router.push(`/fm/${fId}#${anchor}`);
  };

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const history: ChatTurn[] = messages
      .slice(-4)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setBusy(true);

    try {
      setPhase("Searching 51 manuals…");
      const result: AskResult = await askLibrary({
        question,
        mode,
        fmId,
        history,
        signal: ctrl.signal,
      });
      setPhase(mode === "open" ? "Reasoning…" : "Consulting doctrine…");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.answer,
          sources: result.sources,
          mode,
        },
      ]);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text:
              "⚠ The assistant is unavailable right now (" +
              (e?.message || "error") +
              "). This may be a rate limit — try again in a moment.",
            sources: [],
          },
        ]);
      }
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  return (
    <div className="app">
      {/* Band */}
      <div className="ask-band">
        <Link
          href="/"
          className="backlink"
          style={{
            color: "var(--paper)",
            marginBottom: 8,
            display: "inline-flex",
          }}
        >
          ‹ Library
        </Link>
        <div className="ask-band-title">Ask the Doctrine Library</div>
        <div className="ask-band-sub">
          {fm
            ? `Scoped to ${fm.fm_number} · ${fm.title}`
            : "Grounded answers drawn from 51 Field Manuals — every claim cites its source."}
        </div>
      </div>

      {/* Thread */}
      <div className="ask-thread scroll" ref={threadRef}>
        <div className="ask-inner">
          {/* Empty state */}
          {messages.length === 0 && !busy && (
            <div className="ask-empty">
              <div
                className="seal"
                style={{ width: 54, height: 54, fontSize: 15 }}
              >
                APD
              </div>
              <div className="ask-empty-h">Research Assistant</div>
              <div className="ask-empty-p">
                Ask a doctrinal question. Answers are synthesized only from the{" "}
                {fm ? `text of ${fm.fm_number}` : "indexed manuals"} and cite
                the exact sections — tap a citation to jump there.
              </div>
              <div className="ask-sugs">
                {SUGGEST.map((s) => (
                  <button key={s} className="sug" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div className="q-block" key={i}>
                <span className="q-mark">Q</span>
                <span className="q-text">{m.text}</span>
              </div>
            ) : (
              <div className="a-block" key={i}>
                <Answer
                  text={m.text}
                  sources={m.sources || []}
                  onCiteClick={onCiteClick}
                />
                {m.sources && m.sources.length > 0 && (
                  <div className="sources">
                    <div className="sources-h">
                      {m.mode === "open" ? "Related in library" : "Sources"}
                    </div>
                    {m.sources.map((s, idx) => (
                      <div
                        key={idx}
                        className="source"
                        onClick={() => router.push(`/fm/${s.f}#${s.a}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            router.push(`/fm/${s.f}#${s.a}`);
                          }
                        }}
                      >
                        <span className="source-n">{idx + 1}</span>
                        <span className="source-num">{s.n}</span>
                        <span className="source-h">
                          {s.c ? s.c + " › " : ""}
                          {s.h}
                        </span>
                        <span className="source-chev">›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}

          {/* Busy state */}
          {busy && (
            <div className="a-block">
              <div className="thinking">
                <span className="dotpulse" />
                {phase}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="ask-input">
        <div className="ask-mode">
          <span className="ask-mode-label">Answer from</span>
          <div className="seg">
            <button
              className={mode === "library" ? "on" : ""}
              onClick={() => setMode("library")}
            >
              ▤ Library only
            </button>
            <button
              className={mode === "open" ? "on" : ""}
              onClick={() => setMode("open")}
            >
              ✦ Model + Library
            </button>
          </div>
        </div>
        <div className="ask-input-inner">
          <textarea
            ref={taRef}
            value={input}
            rows={1}
            onKeyDown={onKey}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              fm ? `Ask about ${fm.fm_number}…` : "Ask the doctrine library…"
            }
          />
          <button
            className="ask-send"
            disabled={busy || !input.trim()}
            onClick={() => ask(input)}
          >
            Ask ↵
          </button>
        </div>
        <div className="ask-disclaimer">
          {mode === "open"
            ? "May include general knowledge beyond the library — verify against the source manual"
            : "Answered only from indexed manual text — verify against the source manual"}
        </div>
      </div>
    </div>
  );
}
