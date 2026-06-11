// src/app/ask/[id]/page.tsx — FM-scoped Ask page
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
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
      id: fieldManuals.id,
      fm_number: fieldManuals.fm_number,
      title: fieldManuals.title,
    })
    .from(fieldManuals)
    .where(eq(fieldManuals.id, numId));

  if (!fm) notFound();

  return (
    <Suspense fallback={null}>
      <AskPageClient fmId={fm.id} fm={fm} />
    </Suspense>
  );
}
