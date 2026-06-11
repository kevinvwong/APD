// /api/library/bookmarks
//   GET    → list current user's bookmarks
//   POST   → upsert { fm_id, anchor?, note? }
//   DELETE → remove ?fm_id=N&anchor=...
//
// Also accepts a bulk { ids: [fm_id] } body on POST for the
// localStorage → DB migration on first sign-in.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userBookmarks, fieldManuals } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: userBookmarks.id,
      fm_id: userBookmarks.fm_id,
      anchor: userBookmarks.anchor,
      note: userBookmarks.note,
      created_at: userBookmarks.created_at,
      fm_number: fieldManuals.fm_number,
      fm_title: fieldManuals.title,
    })
    .from(userBookmarks)
    .leftJoin(fieldManuals, eq(userBookmarks.fm_id, fieldManuals.id))
    .where(eq(userBookmarks.user_id, userId))
    .orderBy(sql`${userBookmarks.created_at} DESC`);

  return NextResponse.json({ bookmarks: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Bulk migration path: { ids: [fm_id, ...] } from localStorage
  if (Array.isArray(body.ids)) {
    const ids = body.ids
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return NextResponse.json({ ok: true, added: 0 });
    const values = ids.map((fm_id: number) => ({
      user_id: userId,
      fm_id,
      anchor: null,
      note: null,
    }));
    await db.insert(userBookmarks).values(values).onConflictDoNothing();
    return NextResponse.json({ ok: true, added: values.length });
  }

  const fm_id = Number(body.fm_id);
  if (!Number.isInteger(fm_id))
    return NextResponse.json({ error: "missing fm_id" }, { status: 400 });
  const anchor =
    typeof body.anchor === "string" && body.anchor ? body.anchor : null;
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

  await db
    .insert(userBookmarks)
    .values({ user_id: userId, fm_id, anchor, note })
    .onConflictDoUpdate({
      target: [
        userBookmarks.user_id,
        userBookmarks.fm_id,
        userBookmarks.anchor,
      ],
      set: { note },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fm_id = Number(searchParams.get("fm_id"));
  const anchor = searchParams.get("anchor");
  if (!Number.isInteger(fm_id))
    return NextResponse.json({ error: "missing fm_id" }, { status: 400 });

  await db
    .delete(userBookmarks)
    .where(
      and(
        eq(userBookmarks.user_id, userId),
        eq(userBookmarks.fm_id, fm_id),
        anchor
          ? eq(userBookmarks.anchor, anchor)
          : sql`${userBookmarks.anchor} IS NULL`,
      ),
    );
  return NextResponse.json({ ok: true });
}
