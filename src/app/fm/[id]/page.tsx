import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { parseFM } from "@/lib/fm-parse";
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

  const doc = parseFM(fm.content, {
    title: fm.title,
    num: fm.fm_number,
    fmIndex,
  });

  const fmMeta = {
    id: fm.id,
    fm_number: fm.fm_number,
    title: fm.title,
    word_count: fm.word_count,
  };

  return <ReaderClient fm={fmMeta} doc={doc} fmIndex={fmIndex} />;
}
