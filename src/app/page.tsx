// src/app/page.tsx — Root route
// Anonymous users see the landing page.
// Signed-in users see the catalog.

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { CatalogClient } from "@/components/CatalogClient";
import { LandingClient } from "@/components/LandingClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingClient />;
  }

  const fms = await db
    .select({
      id: sources.id,
      fm_number: sources.fm_number,
      title: sources.title,
      word_count: sources.word_count,
      source_type: sources.source_type,
      author: sources.author,
    })
    .from(sources)
    .orderBy(sources.fm_number);

  return <CatalogClient fms={fms} />;
}
