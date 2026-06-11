// src/app/page.tsx — Root route
// Anonymous users see the landing page.
// Signed-in users see the catalog.

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
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
      id: fieldManuals.id,
      fm_number: fieldManuals.fm_number,
      title: fieldManuals.title,
      word_count: fieldManuals.word_count,
    })
    .from(fieldManuals)
    .orderBy(fieldManuals.fm_number);

  return <CatalogClient fms={fms} />;
}
