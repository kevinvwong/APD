// /api/library/recents
//   GET  → list recents (most recent first)
//   POST → record a read { fm_id, last_anchor? }
//   POST with { ids: [fm_id,...] } → bulk migrate from localStorage

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userRecents, fieldManuals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      fm_id: userRecents.fm_id,
      last_anchor: userRecents.last_anchor,
      last_read_at: userRecents.last_read_at,
      fm_number: fieldManuals.fm_number,
      fm_title: fieldManuals.title,
    })
    .from(userRecents)
    .leftJoin(fieldManuals, eq(userRecents.fm_id, fieldManuals.id))
    .where(eq(userRecents.user_id, userId))
    .orderBy(sql`${userRecents.last_read_at} DESC`)
    .limit(20);

  return NextResponse.json({ recents: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.ids)) {
    const ids = body.ids
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return NextResponse.json({ ok: true, added: 0 });
    const values = ids.map((fm_id: number) => ({
      user_id: userId,
      fm_id,
      last_anchor: null,
    }));
    await db.insert(userRecents).values(values).onConflictDoNothing();
    return NextResponse.json({ ok: true, added: values.length });
  }

  const fm_id = Number(body.fm_id);
  if (!Number.isInteger(fm_id))
    return NextResponse.json({ error: "missing fm_id" }, { status: 400 });
  const last_anchor =
    typeof body.last_anchor === "string" && body.last_anchor
      ? body.last_anchor
      : null;

  await db
    .insert(userRecents)
    .values({ user_id: userId, fm_id, last_anchor })
    .onConflictDoUpdate({
      target: [userRecents.user_id, userRecents.fm_id],
      set: { last_anchor, last_read_at: new Date() },
    });
  return NextResponse.json({ ok: true });
}
