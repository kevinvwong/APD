import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import Link from "next/link";
import { buildExcerpt } from "@/lib/excerpt";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  const fms = await db
    .select({
      id: fieldManuals.id,
      fm_number: fieldManuals.fm_number,
      title: fieldManuals.title,
      filename: fieldManuals.filename,
      word_count: fieldManuals.word_count,
      content: fieldManuals.content,
    })
    .from(fieldManuals)
    .where(
      query
        ? or(
            ilike(fieldManuals.fm_number, `%${query}%`),
            ilike(fieldManuals.title, `%${query}%`),
            ilike(fieldManuals.filename, `%${query}%`),
            ilike(fieldManuals.content, `%${query}%`)
          )
        : undefined
    )
    .orderBy(fieldManuals.fm_number);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Army Field Manuals</h1>
      <p className="text-gray-500 mb-8">
        {query ? (
          <>
            {fms.length} {fms.length === 1 ? "result" : "results"} for{" "}
            <span className="font-medium text-gray-700">“{query}”</span> —{" "}
            <Link href="/" className="underline">
              clear
            </Link>
          </>
        ) : (
          <>
            {fms.length} active FMs — sourced from{" "}
            <a
              href="https://armypubs.army.mil"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              armypubs.army.mil
            </a>
          </>
        )}
      </p>

      <form className="mb-8 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by FM number, title, or full text…"
          className="w-full border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Search
        </button>
      </form>

      {fms.length === 0 ? (
        <p className="text-sm text-gray-500">
          No field manuals matched your search.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {fms.map((fm) => {
            // Only surface a body excerpt when the match isn't already obvious
            // from the number/title/filename.
            const inMeta =
              !!query &&
              [fm.fm_number, fm.title, fm.filename].some((f) =>
                f.toLowerCase().includes(query.toLowerCase())
              );
            const excerpt =
              query && !inMeta ? buildExcerpt(fm.content, query) : null;

            return (
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
                  <p className="mt-0.5 font-medium group-hover:underline">
                    {fm.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fm.filename}</p>
                  {excerpt && (
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {excerpt}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
