import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import Link from "next/link";
import { AskPanel } from "@/components/AskPanel";
import { SearchField, FmBadge } from "@/components/ui";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const fms = await db
    .select({
      id: fieldManuals.id,
      fm_number: fieldManuals.fm_number,
      title: fieldManuals.title,
      filename: fieldManuals.filename,
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
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <section className="mb-10 text-center sm:mb-12">
        <span className="brand-chip font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          51 active U.S. Army Field Manuals · full text
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
          Army doctrine, answered in plain English.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
          Ask a question and get an answer cited to the exact Field Manual
          section — then read the source with one click.
        </p>
      </section>

      {/* Ask, across the whole library */}
      <section className="mb-14">
        <AskPanel />
      </section>

      {/* Library */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-gray-900">
              Field Manual library
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {fms.length} {q ? "matching" : "active"} manual
              {fms.length === 1 ? "" : "s"}
              {q && (
                <>
                  {" "}
                  for &ldquo;{q}&rdquo; ·{" "}
                  <Link href="/" className="text-brand-700 hover:underline">
                    clear
                  </Link>
                </>
              )}
            </p>
          </div>

          <form className="w-full sm:w-72">
            <SearchField
              containerClassName="w-full"
              name="q"
              defaultValue={q}
              placeholder="Filter by FM number or title…"
            />
          </form>
        </div>

        {fms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white/50 px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              No manuals match &ldquo;{q}&rdquo;.
            </p>
            <Link
              href="/"
              className="mt-2 inline-block text-sm text-brand-700 hover:underline"
            >
              Show all manuals
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {fms.map((fm) => (
              <li key={fm.id}>
                <Link
                  href={`/fm/${fm.id}`}
                  className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <FmBadge>{fm.fm_number}</FmBadge>
                    <span className="text-[11px] text-gray-400">
                      {fm.word_count.toLocaleString()} words
                    </span>
                  </div>
                  <p className="mt-2 font-medium leading-snug text-gray-900 group-hover:text-brand-700">
                    {fm.title}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
                    Open manual
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
