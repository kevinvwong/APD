// /api/library/highlights
//   GET    → list all of current user's highlights (most recent first)
//   GET ?fm_id=N → highlights for a specific FM
//   POST   → create { fm_id, anchor, selected_text, note?, color? }
//   DELETE ?id=N → remove

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userHighlights, fieldManuals } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

const COLORS = new Set(["gold", "olive", "red"]);

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const fmIdParam = req.nextUrl.searchParams.get("fm_id");
  const fmIdFilter = fmIdParam ? Number(fmIdParam) : null;

  const where = and(
    eq(userHighlights.user_id, userId),
    fmIdFilter !== null && Number.isInteger(fmIdFilter)
      ? eq(userHighlights.fm_id, fmIdFilter)
      : undefined,
  );

  const rows = await db
    .select({
      id: userHighlights.id,
      fm_id: userHighlights.fm_id,
      anchor: userHighlights.anchor,
      selected_text: userHighlights.selected_text,
      note: userHighlights.note,
      color: userHighlights.color,
      created_at: userHighlights.created_at,
      fm_number: fieldManuals.fm_number,
      fm_title: fieldManuals.title,
    })
    .from(userHighlights)
    .leftJoin(fieldManuals, eq(userHighlights.fm_id, fieldManuals.id))
    .where(where)
    .orderBy(sql`${userHighlights.created_at} DESC`)
    .limit(500);

  return NextResponse.json({ highlights: rows });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fm_id = Number(body.fm_id);
  if (!Number.isInteger(fm_id))
    return NextResponse.json({ error: "missing fm_id" }, { status: 400 });
  const anchor = String(body.anchor || "");
  const selected_text = String(body.selected_text || "").slice(0, 4000);
  if (!anchor || !selected_text)
    return NextResponse.json(
      { error: "missing anchor or selected_text" },
      { status: 400 },
    );
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;
  const color = COLORS.has(body.color) ? body.color : "gold";

  const [row] = await db
    .insert(userHighlights)
    .values({ user_id: userId, fm_id, anchor, selected_text, note, color })
    .returning({ id: userHighlights.id });
  return NextResponse.json({ id: row.id });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id))
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  await db
    .delete(userHighlights)
    .where(and(eq(userHighlights.id, id), eq(userHighlights.user_id, userId)));
  return NextResponse.json({ ok: true });
}
