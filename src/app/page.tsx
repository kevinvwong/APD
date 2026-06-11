import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { CatalogClient } from "@/components/CatalogClient";

export const dynamic = "force-dynamic";

export default async function Home() {
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
