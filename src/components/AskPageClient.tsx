"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  askLibrary,
  setMessageStar,
  type AskResult,
  type AskMode,
  type AskSource,
  type ChatTurn,
} from "@/lib/ask-client";

const SUGGEST_GLOBAL = [
  "What are the tenets of multidomain operations?",
  "How does Army doctrine define combat power?",
  "What is the role of a maneuver enhancement brigade?",
  "Summarize the characteristics of the defense.",
];

// Per-FM suggested questions keyed by FM number
const SUGGEST_FM: Record<string, string[]> = {
  "FM 1-000": [
    "What is the Army's purpose and role?",
    "How does the Army organize its forces?",
    "What are the Army's core competencies?",
    "What defines Army culture and values?",
  ],
  "FM 2-0": [
    "What are the intelligence warfighting function tasks?",
    "How does the intelligence process work?",
    "What is the role of the intelligence officer?",
    "How is targeting supported by intelligence?",
  ],
  "FM 3-0": [
    "What are the principles of multidomain operations?",
    "How does the Army defeat enemy anti-access strategies?",
    "What is the role of the corps in large-scale combat?",
    "How does convergence apply in operations?",
  ],
  "FM 3-09": [
    "How is fire support integrated into maneuver?",
    "What are the responsibilities of the fire support officer?",
    "How is the targeting process executed?",
    "What are the principles of mass and economy of force in fires?",
  ],
  "FM 3-24": [
    "What are the principles of counterinsurgency?",
    "How does the population-centric approach work?",
    "What is the role of host-nation forces in COIN?",
    "How is intelligence gathered in a COIN environment?",
  ],
  "FM 3-90": [
    "What are the forms of offensive action?",
    "What is the difference between a movement to contact and an attack?",
    "How is the defense organized?",
    "What are the principles of pursuit?",
  ],
  "FM 5-0": [
    "What is the operations process?",
    "How is the MDMP conducted?",
    "What are the elements of operational art?",
    "How are plans and orders formatted?",
  ],
  "FM 6-0": [
    "How does mission command work?",
    "What are the principles of mission command?",
    "How does the commander's intent guide subordinates?",
    "What is the role of the staff in operations?",
  ],
  "FM 6-22": [
    "What are the attributes of a leader?",
    "How is leadership developed?",
    "What is the difference between direct and organizational leadership?",
    "How does the Army define toxic leadership?",
  ],
  "FM 7-22": [
    "What are the components of holistic health and fitness?",
    "How is physical readiness training structured?",
    "What role does sleep play in soldier performance?",
    "How is the H2F system implemented at the unit level?",
  ],
};

function getSuggestions(fm?: { fm_number: string }): string[] {
  if (!fm) return SUGGEST_GLOBAL;
  return (
    SUGGEST_FM[fm.fm_number] ?? [
      `What are the key doctrinal principles in ${fm.fm_number}?`,
      `What is the primary purpose of ${fm.fm_number}?`,
      `Who are the primary users of ${fm.fm_number}?`,
      `What organizations or units does ${fm.fm_number} apply to?`,
    ]
  );
}

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
  /** Persisted message id when signed in — enables the star button */
  messageId?: number | null;
  starred?: boolean;
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
  const searchParams = useSearchParams();
  const initialConversationId = (() => {
    const v = searchParams.get("conversation");
    const n = v ? Number(v) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  })();
  const [conversationId, setConversationId] = useState<number | null>(
    initialConversationId,
  );
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

  // Load conversation history when arriving with ?conversation=N
  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/library/conversations/${initialConversationId}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.messages) return;
        const loaded: Message[] = data.messages.map(
          (m: {
            id: number;
            role: "user" | "assistant";
            text: string;
            sources: unknown;
            starred: boolean;
          }) => ({
            role: m.role,
            text: m.text,
            sources: (m.sources ?? undefined) as AskSource[] | undefined,
            messageId: m.id,
            starred: !!m.starred,
          }),
        );
        setMessages(loaded);
      } catch {
        // ignore load failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

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
        conversationId,
        signal: ctrl.signal,
      });
      setPhase(mode === "open" ? "Reasoning…" : "Consulting doctrine…");
      // First response on a new thread → store the returned conversationId
      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
        // Reflect in URL so refresh / share-link works without re-creating
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("conversation", String(result.conversationId));
          window.history.replaceState({}, "", url.toString());
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.answer,
          sources: result.sources,
          mode,
          messageId: result.messageId ?? null,
          starred: false,
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
          href={fm ? `/fm/${fm.id}` : "/"}
          className="backlink"
          style={{
            color: "var(--paper)",
            marginBottom: 8,
            display: "inline-flex",
          }}
        >
          ‹ {fm ? fm.fm_number : "Library"}
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
              <div className="ask-empty-h">Research assistant</div>
              <div className="ask-empty-p">
                Ask a doctrinal question. Answers are synthesized only from the{" "}
                {fm ? `text of ${fm.fm_number}` : "indexed manuals"} and cite
                the exact sections — tap a citation to jump there.
              </div>
              <div className="ask-sugs">
                {getSuggestions(fm).map((s) => (
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
                {m.messageId != null && (
                  <button
                    className="star-btn"
                    onClick={async () => {
                      const next = !m.starred;
                      // Optimistic
                      setMessages((prev) =>
                        prev.map((x, ix) =>
                          ix === i ? { ...x, starred: next } : x,
                        ),
                      );
                      try {
                        await setMessageStar(m.messageId!, next);
                      } catch {
                        // Revert on failure
                        setMessages((prev) =>
                          prev.map((x, ix) =>
                            ix === i ? { ...x, starred: !next } : x,
                          ),
                        );
                      }
                    }}
                    title={
                      m.starred ? "Unstar this answer" : "Star this answer"
                    }
                    style={{
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      fontFamily: "var(--head)",
                      fontSize: 12,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: m.starred ? "var(--gold)" : "var(--mute)",
                      padding: "6px 0",
                      marginTop: 4,
                    }}
                  >
                    {m.starred ? "★ Starred" : "☆ Star this answer"}
                  </button>
                )}
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
