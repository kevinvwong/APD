// /api/library/conversations/[id]
//   GET   → load full thread (conversation + messages)
//   PATCH → update conversation { title? }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, cid), eq(conversations.user_id, userId)));
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversation_id, cid))
    .orderBy(asc(messages.created_at));

  return NextResponse.json({ conversation: convo, messages: msgs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const title =
    typeof body.title === "string" ? body.title.slice(0, 200) : undefined;

  if (title === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  await db
    .update(conversations)
    .set({ title, updated_at: new Date() })
    .where(and(eq(conversations.id, cid), eq(conversations.user_id, userId)));
  return NextResponse.json({ ok: true });
}
