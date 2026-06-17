// /api/library/recents
//   GET    → list recents (most recent first)
//   POST   → record a read { fm_id, last_anchor? }   (or bulk { ids:[fm_id] })
//   DELETE → remove ?fm_id=N from recently read

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userRecents, sources } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { withApiError } from "@/lib/api-error";

export const runtime = "nodejs";

export const GET = withApiError("library/recents GET", async () => {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      fm_id: userRecents.fm_id,
      last_anchor: userRecents.last_anchor,
      last_read_at: userRecents.last_read_at,
      fm_number: sources.fm_number,
      fm_title: sources.title,
    })
    .from(userRecents)
    .leftJoin(sources, eq(userRecents.fm_id, sources.id))
    .where(eq(userRecents.user_id, userId))
    .orderBy(sql`${userRecents.last_read_at} DESC`)
    .limit(20);

  return NextResponse.json({ recents: rows });
});

export const POST = withApiError(
  "library/recents POST",
  async (req: NextRequest) => {
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
  },
);

export const DELETE = withApiError(
  "library/recents DELETE",
  async (req: NextRequest) => {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const fm_id = Number(new URL(req.url).searchParams.get("fm_id"));
    if (!Number.isInteger(fm_id))
      return NextResponse.json({ error: "missing fm_id" }, { status: 400 });

    await db
      .delete(userRecents)
      .where(
        and(eq(userRecents.user_id, userId), eq(userRecents.fm_id, fm_id)),
      );
    return NextResponse.json({ ok: true });
  },
);
