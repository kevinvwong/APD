import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { ftsWhere, ftsRank, ftsHeadline, headlineToHtml } from "@/lib/search";

export const dynamic = "force-dynamic";

const baseColumns = {
  id: fieldManuals.id,
  fm_number: fieldManuals.fm_number,
  title: fieldManuals.title,
  filename: fieldManuals.filename,
  word_count: fieldManuals.word_count,
};

type Row = {
  id: number;
  fm_number: string;
  title: string;
  filename: string;
  word_count: number;
  excerptHtml: string | null;
};

async function runSearch(query: string | undefined): Promise<Row[]> {
  if (query) {
    // Full-text search: rank by relevance (weighted title/number > body), with
    // a highlighted ts_headline excerpt.
    const rows = await db
      .select({ ...baseColumns, excerpt: ftsHeadline(query) })
      .from(fieldManuals)
      .where(ftsWhere(query))
      .orderBy(desc(ftsRank(query)), fieldManuals.fm_number);

    return rows.map(({ excerpt, ...r }) => {
      const { html, hasMatch } = headlineToHtml(excerpt ?? "");
      return { ...r, excerptHtml: hasMatch ? html : null };
    });
  }

  const rows = await db
    .select(baseColumns)
    .from(fieldManuals)
    .orderBy(fieldManuals.fm_number);
  return rows.map((r) => ({ ...r, excerptHtml: null }));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || undefined;
  const fms = await runSearch(query);

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
                <p className="mt-0.5 font-medium group-hover:underline">
                  {fm.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{fm.filename}</p>
                {fm.excerptHtml && (
                  <p
                    className="mt-1.5 text-xs text-gray-500 italic [&_mark]:bg-yellow-200 [&_mark]:text-gray-900 [&_mark]:not-italic [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: fm.excerptHtml }}
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
