import { db } from "@/db";
import { fieldManuals, userHighlights } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { parseFM } from "@/lib/fm-parse";
import { getFigureUrls } from "@/lib/figures";
import { ReaderClient } from "@/components/ReaderClient";

export const dynamic = "force-dynamic";

export default async function FmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const [fm] = await db
    .select()
    .from(fieldManuals)
    .where(eq(fieldManuals.id, numId));

  if (!fm) notFound();

  // Build xref map: FM number → FM id (for cross-reference navigation)
  const allFms = await db
    .select({ id: fieldManuals.id, fm_number: fieldManuals.fm_number })
    .from(fieldManuals);
  const fmIndex: Record<string, number> = {};
  for (const f of allFms) fmIndex[f.fm_number] = f.id;

  const figureUrls = getFigureUrls(fm.fm_number);

  const doc = parseFM(fm.content, {
    title: fm.title,
    num: fm.fm_number,
    fmIndex,
    figureUrls,
  });

  const fmMeta = {
    id: fm.id,
    fm_number: fm.fm_number,
    title: fm.title,
    word_count: fm.word_count,
  };

  // Pull this user's saved highlights for this FM (if signed in)
  const { userId } = await auth();
  const highlights = userId
    ? await db
        .select({
          id: userHighlights.id,
          anchor: userHighlights.anchor,
          selected_text: userHighlights.selected_text,
          color: userHighlights.color,
          note: userHighlights.note,
        })
        .from(userHighlights)
        .where(
          and(
            eq(userHighlights.user_id, userId),
            eq(userHighlights.fm_id, fm.id),
          ),
        )
        .orderBy(desc(userHighlights.created_at))
    : [];

  return (
    <ReaderClient
      fm={fmMeta}
      doc={doc}
      fmIndex={fmIndex}
      initialHighlights={highlights}
    />
  );
}
