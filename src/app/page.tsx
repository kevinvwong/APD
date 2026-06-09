import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const fms = await db
    .select({
      id:         fieldManuals.id,
      fm_number:  fieldManuals.fm_number,
      title:      fieldManuals.title,
      filename:   fieldManuals.filename,
      word_count: fieldManuals.word_count,
    })
    .from(fieldManuals)
    .where(
      q
        ? or(
            ilike(fieldManuals.fm_number, `%${q}%`),
            ilike(fieldManuals.title, `%${q}%`),
            ilike(fieldManuals.filename, `%${q}%`)
          )
        : undefined
    )
    .orderBy(fieldManuals.fm_number);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Army Field Manuals</h1>
      <p className="text-gray-500 mb-8">
        {fms.length} active FMs — sourced from{" "}
        <a
          href="https://armypubs.army.mil"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          armypubs.army.mil
        </a>
      </p>

      <form className="mb-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by FM number or title..."
          className="w-full border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </form>

      <ul className="divide-y divide-gray-200">
        {fms.map((fm) => (
          <li key={fm.id} className="py-4">
            <Link href={`/fm/${fm.id}`} className="group">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-semibold text-gray-400 group-hover:text-black">
                  {fm.fm_number}
                </span>
                <span className="text-xs text-gray-400">
                  {fm.word_count.toLocaleString()} words
                </span>
              </div>
              <p className="mt-0.5 font-medium group-hover:underline">{fm.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fm.filename}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
