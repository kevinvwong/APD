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
import { retrieve } from "@/lib/retrieve";
import { buildPrompt, type AskMode, type ChatTurn } from "@/lib/ask-prompt";

export const runtime = "nodejs"; // needs fs to read the index

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const question: string = (body.question || "").toString().trim();
    const mode: AskMode = body.mode === "open" ? "open" : "library";
    const fmId: number | null = body.fmId ? Number(body.fmId) : null;
    const rawHistory: unknown[] = Array.isArray(body.history)
      ? body.history.slice(-4)
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
      .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));

    if (!question)
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    if (question.length > 2000)
      return NextResponse.json(
        { error: "Question too long." },
        { status: 400 },
      );

    const sources = retrieve(question, 8, fmId);

    if (!sources.length && mode === "library") {
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

    // Return only the fields the client needs to render + deep-link.
    return NextResponse.json({
      answer,
      sources: sources.map((s) => ({
        f: s.f,
        n: s.n,
        ft: s.ft,
        a: s.a,
        h: s.h,
        c: s.c,
      })),
    });
  } catch (e: any) {
    console.error("[/api/ask]", e);
    const status = e?.status === 429 ? 429 : e?.status === 401 ? 503 : 500;
    return NextResponse.json({ error: "Assistant unavailable." }, { status });
  }
}
