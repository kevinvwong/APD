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

/** Live callbacks for the streamed answer. Both are optional; omit them to just
 *  await the assembled AskResult. */
export interface AskStreamHandlers {
  onMeta?: (m: { sources: AskSource[]; conversationId: number | null }) => void;
  onDelta?: (text: string) => void;
}

type StreamEvent =
  | { type: "meta"; sources?: AskSource[]; conversationId?: number | null }
  | { type: "delta"; text?: string }
  | { type: "done"; messageId?: number | null }
  | { type: "error"; error?: string };

/**
 * Ask the assistant. The endpoint streams newline-delimited JSON; this consumes
 * the stream, invoking `handlers` as events arrive, and resolves with the fully
 * assembled result. Callers that don't pass handlers simply get the final
 * AskResult once the stream completes.
 */
export async function askLibrary(opts: {
  question: string;
  mode?: AskMode;
  scope?: AskScope;
  fmId?: number | null;
  history?: ChatTurn[];
  conversationId?: number | null;
  signal?: AbortSignal;
  handlers?: AskStreamHandlers;
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
  if (!res.ok || !res.body) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error || `Request failed (${res.status})`);
  }

  let answer = "";
  let sources: AskSource[] = [];
  let conversationId: number | null = null;
  let messageId: number | null = null;

  const handle = (evt: StreamEvent) => {
    if (evt.type === "meta") {
      sources = Array.isArray(evt.sources) ? evt.sources : [];
      conversationId = evt.conversationId ?? null;
      opts.handlers?.onMeta?.({ sources, conversationId });
    } else if (evt.type === "delta") {
      const t = typeof evt.text === "string" ? evt.text : "";
      answer += t;
      opts.handlers?.onDelta?.(t);
    } else if (evt.type === "done") {
      messageId = evt.messageId ?? null;
    } else if (evt.type === "error") {
      throw new Error(evt.error || "Assistant error");
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) handle(JSON.parse(line) as StreamEvent);
    }
  }
  const tail = buf.trim();
  if (tail) handle(JSON.parse(tail) as StreamEvent);

  return { answer, sources, conversationId, messageId };
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
