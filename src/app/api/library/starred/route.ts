// /api/library/starred
//   GET → list user's starred assistant messages
//   POST { message_id, starred } → set star state on a message
//
// Star is stored on `messages.starred`. We verify ownership by joining
// through conversations.user_id.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, messages, fieldManuals } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: messages.id,
      conversation_id: messages.conversation_id,
      text: messages.text,
      sources: messages.sources,
      created_at: messages.created_at,
      fm_id: conversations.fm_id,
      fm_number: fieldManuals.fm_number,
      fm_title: fieldManuals.title,
      conversation_title: conversations.title,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .leftJoin(fieldManuals, eq(conversations.fm_id, fieldManuals.id))
    .where(
      and(
        eq(conversations.user_id, userId),
        eq(messages.starred, true),
        eq(messages.role, "assistant"),
      ),
    )
    .orderBy(desc(messages.created_at))
    .limit(200);

  return NextResponse.json({ starred: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message_id = Number(body.message_id);
  const starred = !!body.starred;
  if (!Number.isInteger(message_id))
    return NextResponse.json({ error: "missing message_id" }, { status: 400 });

  // Ownership check via subquery
  const ownerCheck = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .where(and(eq(messages.id, message_id), eq(conversations.user_id, userId)))
    .limit(1);

  if (ownerCheck.length === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.update(messages).set({ starred }).where(eq(messages.id, message_id));

  // Touch the conversation's updated_at when a message changes
  await db
    .update(conversations)
    .set({ updated_at: new Date() })
    .where(
      sql`${conversations.id} = (SELECT conversation_id FROM ${messages} WHERE id = ${message_id})`,
    );

  return NextResponse.json({ ok: true });
}
