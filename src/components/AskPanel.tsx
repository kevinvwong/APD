"use client";

import { useState, useRef } from "react";
import {
  askLibrary,
  sectionHref,
  type AskResult,
  type AskMode,
  type ChatTurn,
} from "@/lib/ask-client";

interface Props {
  fmId?: number | null;
}

const EXAMPLES = [
  "What are the principles of mission command?",
  "How is an area defense organized?",
  "Define the operations process.",
];

export function AskPanel({ fmId }: Props) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<AskMode>("library");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function run(q: string) {
    if (!q || busy) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await askLibrary({ question: q, mode, fmId, history, signal: ctrl.signal });
      setResult(res);
      setHistory((h) => [
        ...h.slice(-6),
        { role: "user", text: q },
        { role: "assistant", text: res.answer },
      ]);
    } catch (err: any) {
      if (err?.name !== "AbortError") setError(err?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    run(question.trim());
  }

  function reset() {
    abortRef.current?.abort();
    setHistory([]);
    setResult(null);
    setError(null);
    setBusy(false);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Header: title + segmented mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-semibold text-brand-900">
            Doctrine assistant
          </span>
        </div>
        <ModeToggle mode={mode} setMode={setMode} disabled={busy} />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Question input */}
        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={fmId ? "Ask about this manual…" : "Ask about any Field Manual…"}
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Asking" : "Ask"}
            {!busy && <SendIcon className="h-3.5 w-3.5" />}
          </button>
          {history.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </form>

        {/* Mode helper line */}
        <p className="text-xs text-gray-400">
          {mode === "library" ? (
            <>
              <strong className="font-medium text-gray-500">Library only</strong>{" "}
              — answers strictly from indexed FM excerpts, every claim cited.
            </>
          ) : (
            <>
              <strong className="font-medium text-gray-500">Model + Library</strong>{" "}
              — Claude&rsquo;s broader knowledge, supplemented by FM excerpts.
            </>
          )}
        </p>

        {/* Example prompts (only on the cross-library panel, before first ask) */}
        {!fmId && !result && !busy && !error && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuestion(ex);
                  run(ex);
                }}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs text-brand-700 transition hover:border-brand-400 hover:bg-brand-100"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="dot-flashing flex gap-1">
              <span />
              <span />
              <span />
            </span>
            Searching the library…
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                <SparkIcon className="h-3 w-3" />
                Answer
              </div>
              <Answer text={result.answer} sourceCount={result.sources.length} />
            </div>

            {result.sources.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Sources
                </p>
                <ul className="space-y-1.5">
                  {result.sources.map((s, i) => (
                    <li key={i} id={`src-${i + 1}`}>
                      <a
                        href={sectionHref(s)}
                        className="group flex items-start gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2 transition hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-mono text-[10px] font-bold text-amber-700">
                          {i + 1}
                        </span>
                        <span className="text-xs leading-snug">
                          <span className="font-mono font-semibold text-brand-700">
                            {s.n}
                          </span>
                          {s.c && <span className="text-gray-400"> · {s.c}</span>}
                          <span className="block text-gray-700 group-hover:text-brand-800">
                            {s.h}
                          </span>
                        </span>
                        <ArrowIcon className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: AskMode;
  setMode: (m: AskMode) => void;
  disabled: boolean;
}) {
  const opts: { value: AskMode; label: string }[] = [
    { value: "library", label: "Library only" },
    { value: "open", label: "Model + Library" },
  ];
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-xs">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => setMode(o.value)}
          className={`rounded-full px-3 py-1 font-medium transition ${
            mode === o.value
              ? "bg-white text-brand-800 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          } disabled:opacity-60`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Renders the answer text, turning [n] tokens into numbered badge anchors.
function Answer({ text, sourceCount }: { text: string; sourceCount: number }) {
  const parts = text.split(/(\[\d+(?:,\d+)*\])/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-800">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+(?:,\d+)*)\]$/);
        if (m) {
          const nums = m[1]
            .split(",")
            .map(Number)
            .filter((n) => n >= 1 && n <= sourceCount);
          if (!nums.length) return <span key={i}>{part}</span>;
          return (
            <span key={i} className="inline-flex gap-0.5 align-baseline">
              {nums.map((n) => (
                <a
                  key={n}
                  href={`#src-${n}`}
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-100 px-1 font-mono text-[9px] font-bold text-amber-700 transition hover:bg-amber-200"
                >
                  {n}
                </a>
              ))}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

/* --- inline icons (no dependency) --- */
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12 20 4l-5 16-3.5-6L4 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z" />
    </svg>
  );
}
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
