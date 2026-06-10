// src/lib/ask-client.ts
// Client-side wrapper for the doctrine assistant. Use from a "use client" component.

export type AskMode = "library" | "open";
export interface AskSource { f: number; n: string; ft: string; a: string; h: string; c: string }
export interface AskResult { answer: string; sources: AskSource[] }
export interface ChatTurn { role: "user" | "assistant"; text: string }

export async function askLibrary(opts: {
  question: string;
  mode?: AskMode;
  fmId?: number | null;
  history?: ChatTurn[];
  signal?: AbortSignal;
}): Promise<AskResult> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: opts.question,
      mode: opts.mode || "library",
      fmId: opts.fmId ?? null,
      history: opts.history || [],
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Deep-link to a section in the reader (e.g. `/fm/${f}#${a}`).
export function sectionHref(s: AskSource): string {
  return `/fm/${s.f}#${s.a}`;
}
