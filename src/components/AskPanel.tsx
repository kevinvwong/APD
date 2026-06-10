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

export function AskPanel({ fmId }: Props) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<AskMode>("library");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const res = await askLibrary({
        question: q,
        mode,
        fmId,
        history,
        signal: ctrl.signal,
      });
      setResult(res);
      setHistory((h) => [
        ...h.slice(-6),
        { role: "user", text: q },
        { role: "assistant", text: res.answer },
      ]);
    } catch (err: any) {
      if (err?.name !== "AbortError")
        setError(err?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          Ask the doctrine assistant
        </span>
        <div className="flex gap-1 text-xs">
          {(["library", "open"] as AskMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded border transition-colors ${
                mode === m
                  ? "bg-black text-white border-black"
                  : "text-gray-500 border-gray-300 hover:border-gray-500"
              }`}
            >
              {m === "library" ? "Library only" : "Model + Library"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={fmId ? "Ask about this manual…" : "Ask about any FM…"}
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="px-4 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {busy ? "…" : "Ask"}
        </button>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setHistory([]);
              setResult(null);
              setError(null);
            }}
            className="px-3 py-1.5 text-xs text-gray-400 border border-gray-200 rounded hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <Answer text={result.answer} sourceCount={result.sources.length} />
          {result.sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sources
              </p>
              <ul className="space-y-1">
                {result.sources.map((s, i) => (
                  <li
                    key={i}
                    id={`src-${i + 1}`}
                    className="flex items-baseline gap-2 text-xs"
                  >
                    <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 font-mono font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <a
                      href={sectionHref(s)}
                      className="text-blue-600 hover:underline"
                    >
                      <span className="font-mono text-gray-500">{s.n}</span>
                      {" — "}
                      {s.c ? (
                        <span className="text-gray-400">{s.c} &rsaquo; </span>
                      ) : null}
                      {s.h}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders the answer text, turning [n] tokens into numbered badge anchors.
function Answer({ text, sourceCount }: { text: string; sourceCount: number }) {
  const parts = text.split(/(\[\d+(?:,\d+)*\])/g);
  return (
    <div className="text-sm text-gray-800 leading-relaxed space-y-2">
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+(?:,\d+)*)\]$/);
        if (m) {
          const nums = m[1]
            .split(",")
            .map(Number)
            .filter((n) => n >= 1 && n <= sourceCount);
          if (!nums.length) return <span key={i}>{part}</span>;
          return (
            <span key={i} className="inline-flex gap-0.5">
              {nums.map((n) => (
                <a
                  key={n}
                  href={`#src-${n}`}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-mono font-bold text-[9px] hover:bg-blue-200"
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
