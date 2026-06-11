// /api/library/conversations
//   GET  → list current user's conversations (most recent first, limit 50)
//   POST → create a new conversation { fm_id?, title?, mode? }
//          returns { id }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: conversations.id,
      fm_id: conversations.fm_id,
      title: conversations.title,
      mode: conversations.mode,
      updated_at: conversations.updated_at,
      message_count: sql<number>`(SELECT count(*) FROM ${messages} WHERE ${messages.conversation_id} = ${conversations.id})`,
    })
    .from(conversations)
    .where(eq(conversations.user_id, userId))
    .orderBy(desc(conversations.updated_at))
    .limit(50);

  return NextResponse.json({ conversations: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fm_id =
    typeof body.fm_id === "number" && Number.isInteger(body.fm_id)
      ? body.fm_id
      : null;
  const title = (body.title ?? "").toString().slice(0, 200);
  const mode = body.mode === "open" ? "open" : "library";

  const [row] = await db
    .insert(conversations)
    .values({ user_id: userId, fm_id, title, mode })
    .returning({ id: conversations.id });

  return NextResponse.json({ id: row.id });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.user_id, userId)));
  return NextResponse.json({ ok: true });
}
