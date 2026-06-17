// src/app/api/ask/route.ts
// Server-side doctrine assistant endpoint.
// POST { question, history?, mode?, scope?, fmId?, conversationId? }
//   -> streamed newline-delimited JSON (application/x-ndjson):
//        {type:"meta", sources, conversationId}
//        {type:"delta", text}            (repeated as the answer streams)
//        {type:"done", messageId}
//        {type:"error", error}
//   Validation failures return a normal JSON error response (non-streamed).
//
// Requires:  npm install @anthropic-ai/sdk
// Env:       ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional)
//
// The API key lives only on the server — never ship it to the browser.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { retrieve, type Section } from "@/lib/retrieve";
import { retrieve as retrievePg } from "@/lib/retrieve-pg";
import { retrieve as retrieveHybrid } from "@/lib/retrieve-hybrid";
import { buildPrompt, type AskMode, type ChatTurn } from "@/lib/ask-prompt";

export const runtime = "nodejs"; // needs fs to read the index

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Retrieval backend selector. Default ("json") keeps the existing, build-safe
// JSON-file path. "pg" uses the OPTIONAL Postgres full-text path, "hybrid"
// fuses keyword + pgvector semantic search. The pg/hybrid backends require a
// live DB with fm_sections populated (and, for hybrid, embeddings + a provider
// key). All share the same (question, k, restrictFm, includePrivate, scope) ->
// Section[] contract; the async ones are awaited.
const BACKEND = (process.env.RETRIEVE_BACKEND || "json").toLowerCase();

type Scope = "all" | "doctrine" | "book";

// Per-cold-start cache for the pg/hybrid backend health probe. `null` means
// "not yet probed". A misconfigured backend (table missing, empty, embeddings
// unset) flips this to `false` after one probe and stays there for the life
// of the process, so we don't hammer Neon with a doomed query on every Ask.
let pgBackendHealthy: boolean | null = null;

/**
 * Cheap, cached health probe for the configured pg/hybrid backend. Decides
 * whether retrieval is allowed to attempt the live DB path at all.
 *
 * Distinguishes the two cases the old `out.length === 0 -> fall back` heuristic
 * conflated:
 *   - Backend healthy, query has zero hits  -> probe says true, caller returns
 *     the empty result to the user as intended.
 *   - Backend unhealthy (table missing/empty/misconfigured) -> probe says
 *     false, caller skips the backend entirely and uses JSON.
 *
 * Cached per cold start; warns ONCE on first failure.
 */
async function probePgBackend(): Promise<boolean> {
  if (pgBackendHealthy !== null) return pgBackendHealthy;
  try {
    // Reuses the existing Neon connection from `@/db` — same one
    // retrieve-pg.ts uses. SELECT 1 ... LIMIT 1 is the canonical "is the
    // table reachable AND non-empty" probe.
    const rows = await db.execute<{ ok: number }>(
      sql`SELECT 1 AS ok FROM fm_sections LIMIT 1`,
    );
    const list: unknown[] = Array.isArray(rows)
      ? (rows as unknown[])
      : ((rows as { rows?: unknown[] }).rows ?? []);
    if (list.length >= 1) {
      pgBackendHealthy = true;
      return true;
    }
    pgBackendHealthy = false;
    console.warn(
      "[ask] pg backend unhealthy; falling back to JSON for all queries this cold start. Cause:",
      "fm_sections returned 0 rows (table empty / not populated)",
    );
    return false;
  } catch (e) {
    pgBackendHealthy = false;
    console.warn(
      "[ask] pg backend unhealthy; falling back to JSON for all queries this cold start. Cause:",
      e,
    );
    return false;
  }
}

async function getSources(
  question: string,
  k: number,
  restrictFm: number | null,
  includePrivate: boolean,
  scope: Scope,
): Promise<Section[]> {
  // The pg/hybrid backends depend on live DB state (fm_sections populated,
  // pgvector, etc.). Two distinct cases the route must handle differently:
  //
  //   1. Backend unhealthy (table missing/empty/misconfigured) -> the probe
  //      flips a per-cold-start flag to false; we skip the live backend
  //      entirely and serve from JSON.
  //   2. Backend healthy + query returns rows -> return them.
  //   3. Backend healthy + query returns ZERO rows -> return empty. The user
  //      asked something with no hits in the corpus; the route surfaces the
  //      canned "no results" fallback message to them. We must NOT silently
  //      answer from a different backend.
  //
  // Thrown errors during a normal query (transient DB blip) still fall through
  // to the JSON path via the catch below, matching prior behaviour.
  if (BACKEND === "hybrid" || BACKEND === "pg") {
    const healthy = await probePgBackend();
    if (!healthy) {
      return retrieve(question, k, restrictFm, includePrivate, scope);
    }
    try {
      const out =
        BACKEND === "hybrid"
          ? await retrieveHybrid(question, k, restrictFm, includePrivate, scope)
          : await retrievePg(question, k, restrictFm, includePrivate, scope);
      // Healthy backend, legitimate result (possibly empty) -> return as-is.
      return out;
    } catch (e) {
      console.error(
        `[/api/ask] "${BACKEND}" retrieval threw; falling back to json backend for this request:`,
        e,
      );
      return retrieve(question, k, restrictFm, includePrivate, scope);
    }
  }
  return retrieve(question, k, restrictFm, includePrivate, scope);
}

// Input bounds — keep the LLM context (and abuse surface) small and predictable.
const MAX_QUESTION_CHARS = 2000; // matches the client-side UX limit
const MAX_HISTORY_TURNS = 4; // only the last few turns are useful for context
const MAX_HISTORY_TEXT_CHARS = 2000; // per-turn cap so a single turn can't blow up the prompt
const MAX_BODY_BYTES = 64 * 1024; // generous for question + a few short history turns
const MAX_FM_ID = 100_000; // far above any real FM id; rejects absurd/huge ids

export async function POST(req: NextRequest) {
  try {
    // Defensive body-size cap: reject obviously oversized payloads before we
    // buffer/parse them. Content-Length can be spoofed/absent, so we also guard
    // on the actual parsed text below.
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large." },
        { status: 413 },
      );
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large." },
        { status: 413 },
      );
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
    if (typeof body !== "object" || body === null) body = {};

    const question: string = (body.question ?? "").toString().trim();

    // mode must be exactly one of the known values; anything else -> "library".
    const mode: AskMode = body.mode === "open" ? "open" : "library";

    // scope restricts retrieval to one corpus; anything else -> "all".
    const scope: Scope =
      body.scope === "doctrine" || body.scope === "book" ? body.scope : "all";

    // fmId: accept only a positive, in-range integer; otherwise treat as "no filter".
    let fmId: number | null = null;
    if (body.fmId !== null && body.fmId !== undefined && body.fmId !== "") {
      const n = Number(body.fmId);
      if (Number.isInteger(n) && n > 0 && n <= MAX_FM_ID) fmId = n;
    }

    // history: take only the last few turns, coerce/drop malformed entries, and
    // cap each turn's text. This is the prompt-injection surface, so be strict.
    const rawHistory: unknown[] = Array.isArray(body.history)
      ? body.history.slice(-MAX_HISTORY_TURNS)
      : [];
    const safeHistory: ChatTurn[] = rawHistory
      .filter((m): m is ChatTurn => {
        if (typeof m !== "object" || m === null) return false;
        const role = (m as any).role;
        const text = (m as any).text;
        return (
          (role === "user" || role === "assistant") &&
          typeof text === "string" &&
          text.trim().length > 0
        );
      })
      .map((m) => ({
        role: m.role,
        text: m.text.slice(0, MAX_HISTORY_TEXT_CHARS),
      }));

    if (!question)
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    if (question.length > MAX_QUESTION_CHARS)
      return NextResponse.json(
        { error: "Question too long." },
        { status: 400 },
      );

    // Auth gates access to private sources (e.g. copyrighted books): only a
    // signed-in caller may retrieve them. Resolve it before retrieval so the
    // includePrivate flag reflects the real session.
    const { userId } = await auth();

    const sources = await getSources(question, 12, fmId, !!userId, scope);

    // Optional resume: { conversationId } from the client lets logged-in users
    // continue a thread. Verified for ownership below.
    const rawConvoId = Number(body.conversationId);
    const requestedConvoId =
      Number.isInteger(rawConvoId) && rawConvoId > 0 ? rawConvoId : null;

    const sourceObjs = sources.map((s) => ({
      f: s.f,
      n: s.n,
      ft: s.ft,
      a: s.a,
      h: s.h,
      c: s.c,
      st: s.st ?? "doctrine",
    }));

    const encoder = new TextEncoder();
    const FALLBACK =
      'I couldn\'t find anything relevant in the indexed sources for that. Try rephrasing with doctrinal terms, or switch to "Model + Library".';

    // Stream the answer as newline-delimited JSON events:
    //   {type:"meta", sources, conversationId}
    //   {type:"delta", text}            (repeated)
    //   {type:"done", messageId}
    //   {type:"error", error}
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        try {
          // No-results fallback (library mode): stream the canned message and
          // do not persist — it'd just clutter conversation history.
          if (!sources.length && mode === "library") {
            send({ type: "meta", sources: [], conversationId: null });
            send({ type: "delta", text: FALLBACK });
            send({ type: "done", messageId: null });
            controller.close();
            return;
          }

          // Create/resume the conversation and persist the question up front so
          // the client receives a conversationId before tokens start flowing.
          let conversationId: number | null = null;
          if (userId) {
            try {
              let convo: { id: number } | undefined;
              if (requestedConvoId) {
                const [row] = await db
                  .select({ id: conversations.id })
                  .from(conversations)
                  .where(
                    and(
                      eq(conversations.id, requestedConvoId),
                      eq(conversations.user_id, userId),
                    ),
                  );
                convo = row;
              }
              if (!convo) {
                const [row] = await db
                  .insert(conversations)
                  .values({
                    user_id: userId,
                    fm_id: fmId,
                    title: question.slice(0, 120),
                    mode,
                  })
                  .returning({ id: conversations.id });
                convo = row;
              } else {
                await db
                  .update(conversations)
                  .set({ updated_at: new Date() })
                  .where(eq(conversations.id, convo.id));
              }
              conversationId = convo.id;
              await db.insert(messages).values({
                conversation_id: convo.id,
                role: "user",
                text: question,
              });
            } catch (e) {
              // Persistence failures must not break the answer.
              console.error("[/api/ask] convo persist failed:", e);
              conversationId = null;
            }
          }

          send({ type: "meta", sources: sourceObjs, conversationId });

          // Stream the model's answer token-by-token.
          const prompt = buildPrompt(question, sources, safeHistory, mode);
          const llm = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 1024,
            stream: true,
            messages: [{ role: "user", content: prompt }],
          });
          let answer = "";
          for await (const ev of llm) {
            if (
              ev.type === "content_block_delta" &&
              ev.delta.type === "text_delta"
            ) {
              answer += ev.delta.text;
              send({ type: "delta", text: ev.delta.text });
            }
          }

          // Persist the assistant turn now that the full text is known.
          let messageId: number | null = null;
          if (userId && conversationId != null) {
            try {
              const [aMsg] = await db
                .insert(messages)
                .values({
                  conversation_id: conversationId,
                  role: "assistant",
                  text: answer,
                  sources: sourceObjs,
                })
                .returning({ id: messages.id });
              messageId = aMsg.id;
            } catch (e) {
              console.error("[/api/ask] answer persist failed:", e);
            }
          }
          send({ type: "done", messageId });
          controller.close();
        } catch (e) {
          console.error("[/api/ask] stream error:", e);
          send({ type: "error", error: "Assistant unavailable." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: any) {
    // Log full detail server-side only; never leak SDK/internal messages to the
    // client. Preserve 429 (rate limit) passthrough; map auth errors to 503.
    console.error("[/api/ask]", e);
    const status = e?.status === 429 ? 429 : e?.status === 401 ? 503 : 500;
    return NextResponse.json({ error: "Assistant unavailable." }, { status });
  }
}
