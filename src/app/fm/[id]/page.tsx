import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseFM, type Block } from "@/lib/fm-parse";
import { AskPanel } from "@/components/AskPanel";

export const dynamic = "force-dynamic";

export default async function FmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [fm] = await db
    .select()
    .from(fieldManuals)
    .where(eq(fieldManuals.id, Number(id)));

  if (!fm) notFound();

  const doc = parseFM(fm.content, { title: fm.title, num: fm.fm_number });

  // Group consecutive 'li' blocks into arrays; all other blocks stand alone.
  type Group =
    | { type: "list"; items: Extract<Block, { type: "li" }>[] }
    | { type: "single"; block: Block };
  const groups: Group[] = [];
  for (const block of doc.blocks) {
    if (block.type === "li") {
      const last = groups[groups.length - 1];
      if (last?.type === "list") last.items.push(block);
      else groups.push({ type: "list", items: [block] });
    } else {
      groups.push({ type: "single", block });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M19 12H5m6 6-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All Field Manuals
      </Link>

      {/* Title block */}
      <header className="mb-6 border-b border-gray-200 pb-6">
        <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 font-mono text-sm font-bold text-brand-700">
          {fm.fm_number}
        </span>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-gray-900">
          {fm.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
          <span className="font-mono">{fm.filename}</span>
          <span aria-hidden>·</span>
          <span>{fm.word_count.toLocaleString()} words</span>
          {doc.meta.date && (
            <>
              <span aria-hidden>·</span>
              <span>{doc.meta.date}</span>
            </>
          )}
          {doc.meta.restriction && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
              {doc.meta.restriction}
            </span>
          )}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
        {/* Sidebar TOC (desktop) */}
        {doc.toc.length > 0 && (
          <aside className="hidden lg:block">
            <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Contents
              </p>
              <ol className="space-y-1 border-l border-gray-200">
                {doc.toc.map((e) => (
                  <li key={e.id}>
                    <a
                      href={`#${e.id}`}
                      className={`-ml-px block border-l-2 py-0.5 text-sm transition ${
                        e.level === 2
                          ? "border-transparent pl-5 text-gray-500 hover:border-brand-300 hover:text-brand-700"
                          : "border-transparent pl-3 font-medium text-gray-700 hover:border-brand-500 hover:text-brand-800"
                      }`}
                    >
                      {e.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        )}

        {/* Main column */}
        <div className="min-w-0">
          <div className="mb-8">
            <AskPanel fmId={fm.id} />
          </div>

          {/* Collapsible TOC (mobile) */}
          {doc.toc.length > 0 && (
            <details className="mb-8 rounded-xl border border-gray-200 bg-white p-4 lg:hidden">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
                Contents
              </summary>
              <ol className="mt-3 space-y-1">
                {doc.toc.map((e) => (
                  <li key={e.id} className={e.level === 2 ? "pl-4" : ""}>
                    <a href={`#${e.id}`} className="text-sm text-brand-700 hover:underline">
                      {e.text}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <article className="fm-article space-y-2.5 text-[15px] leading-relaxed">
            {groups.map((g, i) =>
              g.type === "list" ? (
                <ul
                  key={`list-${i}`}
                  className="ml-1 list-disc space-y-1 pl-5 marker:text-brand-400"
                >
                  {g.items.map((b, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: b.html }} />
                  ))}
                </ul>
              ) : (
                <BlockRenderer
                  key={g.block.type === "h" ? g.block.id : `${g.block.type}-${i}`}
                  block={g.block}
                />
              )
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "h": {
      if (block.level === 1) {
        return (
          <h2
            id={block.id}
            className="mt-10 mb-3 border-b border-gray-200 pb-1.5 font-serif text-2xl font-bold text-gray-900 first:mt-0"
          >
            {block.text}
          </h2>
        );
      }
      if (block.level === 2) {
        return (
          <h3 id={block.id} className="mt-7 mb-1.5 text-lg font-semibold text-gray-900">
            {block.text}
          </h3>
        );
      }
      return (
        <h4 id={block.id} className="mt-5 mb-1 text-sm font-semibold uppercase tracking-wide text-brand-700">
          {block.text}
        </h4>
      );
    }
    case "p":
      return <p dangerouslySetInnerHTML={{ __html: block.html }} />;
    case "fig":
      return (
        <p className="border-l-2 border-brand-200 bg-brand-50/40 py-1.5 pl-3 text-sm text-gray-600">
          <strong className="font-semibold text-brand-700">{block.label}.</strong>{" "}
          <span className="italic">{block.text}</span>
        </p>
      );
    case "tr":
      return (
        <div
          className="grid gap-2 border-b border-gray-100 py-1.5 text-sm"
          style={{
            gridTemplateColumns: `repeat(${block.cells.length}, minmax(0, 1fr))`,
          }}
        >
          {block.cells.map((c, i) => (
            <span key={i} dangerouslySetInnerHTML={{ __html: c }} />
          ))}
        </div>
      );
    case "li":
      // Standalone li unreachable — grouped in parent before BlockRenderer is called.
      return null;
  }
}
