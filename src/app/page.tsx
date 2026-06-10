import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import Link from "next/link";
import { ftsWhere, ftsRank, ftsHeadline, headlineToHtml } from "@/lib/search";
import SeriesFilter, { type SeriesCount } from "@/components/SeriesFilter";
import { seriesLabel } from "@/lib/series";

export const dynamic = "force-dynamic";

const baseColumns = {
  id: fieldManuals.id,
  fm_number: fieldManuals.fm_number,
  title: fieldManuals.title,
  filename: fieldManuals.filename,
  word_count: fieldManuals.word_count,
  publication_date: fieldManuals.publication_date,
  chapter_count: fieldManuals.chapter_count,
};

type Row = {
  id: number;
  fm_number: string;
  title: string;
  filename: string;
  word_count: number;
  publication_date: string | null;
  chapter_count: number;
  excerptHtml: string | null;
};

function sortOrder(sort: string): SQL | PgColumn {
  if (sort === "title") return fieldManuals.title;
  if (sort === "words") return desc(fieldManuals.word_count);
  return fieldManuals.fm_number;
}

async function runSearch(
  query: string | undefined,
  series: string | undefined,
  sort: string
): Promise<Row[]> {
  const where = and(
    query ? ftsWhere(query) : undefined,
    series ? eq(fieldManuals.fm_series, series) : undefined
  );

  if (query) {
    const rows = await db
      .select({ ...baseColumns, excerpt: ftsHeadline(query) })
      .from(fieldManuals)
      .where(where)
      .orderBy(desc(ftsRank(query)), fieldManuals.fm_number);
    return rows.map(({ excerpt, ...r }) => {
      const { html, hasMatch } = headlineToHtml(excerpt ?? "");
      return { ...r, excerptHtml: hasMatch ? html : null };
    });
  }

  const rows = await db
    .select(baseColumns)
    .from(fieldManuals)
    .where(where)
    .orderBy(sortOrder(sort));
  return rows.map((r) => ({ ...r, excerptHtml: null }));
}

async function seriesCounts(query: string | undefined): Promise<{
  counts: SeriesCount[];
  total: number;
}> {
  // Counts reflect the active text query but ignore the series selection, so
  // the chips always show how many results each series has for this search.
  const rows = await db
    .select({ series: fieldManuals.fm_series, count: sql<number>`count(*)::int` })
    .from(fieldManuals)
    .where(query ? ftsWhere(query) : undefined)
    .groupBy(fieldManuals.fm_series);

  const counts = rows
    .map((r) => ({ series: r.series, label: seriesLabel(r.series), count: Number(r.count) }))
    .sort((a, b) => Number(a.series) - Number(b.series));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return { counts, total };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; series?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const series = sp.series?.trim() || undefined;
  const sort = sp.sort?.trim() || "number";

  const [fms, { counts, total }] = await Promise.all([
    runSearch(query, series, sort),
    seriesCounts(query),
  ]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Army Field Manuals</h1>
      <p className="text-gray-500 mb-8">
        {query ? (
          <>
            {fms.length} {fms.length === 1 ? "result" : "results"} for{" "}
            <span className="font-medium text-gray-700">“{query}”</span>
            {series && <> in {seriesLabel(series)}</>} —{" "}
            <Link href="/" className="underline">
              clear
            </Link>
          </>
        ) : (
          <>
            {total} active FMs — sourced from{" "}
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

      <form className="mb-6 flex gap-2">
        {series && <input type="hidden" name="series" value={series} />}
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

      <SeriesFilter counts={counts} total={total} />

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
                <p className="text-xs text-gray-400 mt-0.5">
                  {fm.filename}
                  {fm.publication_date && ` · ${fm.publication_date.slice(0, 4)}`}
                  {fm.chapter_count > 0 &&
                    ` · ${fm.chapter_count} ${fm.chapter_count === 1 ? "chapter" : "chapters"}`}
                </p>
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
