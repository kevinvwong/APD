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
      if (last?.type === "list") {
        last.items.push(block);
      } else {
        groups.push({ type: "list", items: [block] });
      }
    } else {
      groups.push({ type: "single", block });
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/"
        className="text-sm text-gray-500 hover:underline mb-6 block"
      >
        &larr; All Field Manuals
      </Link>

      <div className="mb-6">
        <span className="font-mono text-sm text-gray-400">{fm.fm_number}</span>
        <h1 className="text-2xl font-bold mt-1">{fm.title}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {fm.filename} &middot; {fm.word_count.toLocaleString()} words
          {doc.meta.date && <> &middot; {doc.meta.date}</>}
        </p>
      </div>

      <div className="mb-8">
        <AskPanel fmId={fm.id} />
      </div>

      {doc.toc.length > 0 && (
        <nav className="mb-8 border border-gray-200 rounded p-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Contents
          </p>
          <ol className="space-y-1">
            {doc.toc.map((e) => (
              <li key={e.id} className={e.level === 2 ? "pl-4" : ""}>
                <a
                  href={`#${e.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {e.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <article className="space-y-2 text-sm leading-relaxed">
        {groups.map((g, i) =>
          g.type === "list" ? (
            <ul
              key={`list-${i}`}
              className="list-disc list-inside pl-4 space-y-0.5"
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
          ),
        )}
      </article>
    </main>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "h": {
      const Tag = (
        block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4"
      ) as "h2" | "h3" | "h4";
      const cls =
        block.level === 1
          ? "text-xl font-bold mt-8 mb-2 border-b border-gray-200 pb-1"
          : block.level === 2
            ? "text-base font-semibold mt-6 mb-1"
            : "text-sm font-semibold mt-4 mb-0.5 text-gray-700";
      return (
        <Tag id={block.id} className={cls}>
          {block.text}
        </Tag>
      );
    }
    case "p":
      return <p dangerouslySetInnerHTML={{ __html: block.html }} />;
    case "fig":
      return (
        <p className="text-xs text-gray-500 italic">
          <strong>{block.label}.</strong> {block.text}
        </p>
      );
    case "tr":
      return (
        <div
          className="grid gap-2 border-b border-gray-100 py-1"
          style={{
            gridTemplateColumns: `repeat(${block.cells.length}, minmax(0, 1fr))`,
          }}
        >
          {block.cells.map((c, i) => (
            <span
              key={i}
              className="text-xs"
              dangerouslySetInnerHTML={{ __html: c }}
            />
          ))}
        </div>
      );
    case "li":
      // Standalone li unreachable — grouped in parent before BlockRenderer is called.
      return null;
  }
}
