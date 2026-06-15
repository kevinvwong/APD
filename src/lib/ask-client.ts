// src/lib/ask-client.ts
// Client-side wrapper for the doctrine assistant. Use from a "use client" component.

export type AskMode = "library" | "open";
/** Which corpus the library retrieval should draw from. */
export type AskScope = "all" | "doctrine" | "book";
export interface AskSource {
  f: number;
  n: string;
  ft: string;
  a: string;
  h: string;
  c: string;
  /** "doctrine" | "book" — lets the UI badge a cited source by type */
  st?: string;
}
export interface AskResult {
  answer: string;
  sources: AskSource[];
  /** Set when the user is signed in and the answer was persisted */
  conversationId?: number | null;
  /** ID of the persisted assistant message — used by the Star button */
  messageId?: number | null;
}
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export async function askLibrary(opts: {
  question: string;
  mode?: AskMode;
  scope?: AskScope;
  fmId?: number | null;
  history?: ChatTurn[];
  conversationId?: number | null;
  signal?: AbortSignal;
}): Promise<AskResult> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: opts.question,
      mode: opts.mode || "library",
      scope: opts.scope || "all",
      fmId: opts.fmId ?? null,
      history: opts.history || [],
      conversationId: opts.conversationId ?? null,
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

/** Toggle a star on a persisted assistant message. Requires signed-in user. */
export async function setMessageStar(
  messageId: number,
  starred: boolean,
): Promise<void> {
  const res = await fetch("/api/library/starred", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id: messageId, starred }),
  });
  if (!res.ok) throw new Error(`Star failed (${res.status})`);
}
