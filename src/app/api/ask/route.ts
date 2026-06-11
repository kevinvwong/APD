// src/app/api/ask/route.ts
// Server-side doctrine assistant endpoint.
// POST { question, history?, mode?, fmId? } -> { answer, sources }
//
// Requires:  npm install @anthropic-ai/sdk
// Env:       ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional)
//
// The API key lives only on the server — never ship it to the browser.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { retrieve, type Section } from "@/lib/retrieve";
import { retrieve as retrievePg } from "@/lib/retrieve-pg";
import { buildPrompt, type AskMode, type ChatTurn } from "@/lib/ask-prompt";

export const runtime = "nodejs"; // needs fs to read the index

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Retrieval backend selector. Default ("json") keeps the existing,
// build-safe JSON-file path. Set RETRIEVE_BACKEND=pg to use the OPTIONAL
// Postgres full-text path (src/lib/retrieve-pg.ts), which requires a live DB
// with the fm_sections table + tsvector index populated. Both share the same
// (question, k, restrictFm) -> Section[] contract; retrievePg is async.
const USE_PG = process.env.RETRIEVE_BACKEND === "pg";

async function getSources(
  question: string,
  k: number,
  restrictFm: number | null,
): Promise<Section[]> {
  return USE_PG
    ? retrievePg(question, k, restrictFm)
    : retrieve(question, k, restrictFm);
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

    const sources = await getSources(question, 12, fmId);

    // Optional resume: { conversationId } from the client lets logged-in users
    // continue a thread. Verified for ownership below.
    const rawConvoId = Number(body.conversationId);
    const requestedConvoId =
      Number.isInteger(rawConvoId) && rawConvoId > 0 ? rawConvoId : null;

    const { userId } = await auth();

    if (!sources.length && mode === "library") {
      // Don't persist the "no results" fallback — it'd clutter conversation history
      return NextResponse.json({
        answer:
          'I couldn\'t find anything relevant in the indexed manuals for that. Try rephrasing with doctrinal terms, or switch to "Model + Library".',
        sources: [],
      });
    }

    const prompt = buildPrompt(question, sources, safeHistory, mode);
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const answer = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const sourceObjs = sources.map((s) => ({
      f: s.f,
      n: s.n,
      ft: s.ft,
      a: s.a,
      h: s.h,
      c: s.c,
    }));

    // Persist to user's library if signed in
    let conversationId: number | null = null;
    let messageId: number | null = null;
    if (userId) {
      try {
        // Verify or create conversation
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

        // Save the Q + A
        await db.insert(messages).values({
          conversation_id: convo.id,
          role: "user",
          text: question,
        });
        const [aMsg] = await db
          .insert(messages)
          .values({
            conversation_id: convo.id,
            role: "assistant",
            text: answer,
            sources: sourceObjs,
          })
          .returning({ id: messages.id });
        messageId = aMsg.id;
      } catch (e) {
        // Persistence failures should not break the user-facing answer
        console.error("[/api/ask] persist failed:", e);
      }
    }

    return NextResponse.json({
      answer,
      sources: sourceObjs,
      conversationId,
      messageId,
    });
  } catch (e: any) {
    // Log full detail server-side only; never leak SDK/internal messages to the
    // client. Preserve 429 (rate limit) passthrough; map auth errors to 503.
    console.error("[/api/ask]", e);
    const status = e?.status === 429 ? 429 : e?.status === 401 ? 503 : 500;
    return NextResponse.json({ error: "Assistant unavailable." }, { status });
  }
}
