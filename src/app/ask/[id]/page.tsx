// src/app/ask/[id]/page.tsx — FM-scoped Ask page
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AskPageClient } from "@/components/AskPageClient";

export const dynamic = "force-dynamic";

export default async function AskFmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);

  if (isNaN(numId)) notFound();

  const [fm] = await db
    .select({
      id: sources.id,
      fm_number: sources.fm_number,
      title: sources.title,
    })
    .from(sources)
    .where(eq(sources.id, numId));

  if (!fm) notFound();

  return (
    <Suspense fallback={null}>
      <AskPageClient fmId={fm.id} fm={fm} />
    </Suspense>
  );
}
