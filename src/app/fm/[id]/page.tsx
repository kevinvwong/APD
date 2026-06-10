import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import Toc from "@/components/Toc";

export const dynamic = "force-dynamic";

export default async function FmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const [fm] = await db
    .select()
    .from(fieldManuals)
    .where(eq(fieldManuals.id, numericId));

  if (!fm) notFound();

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:underline mb-6 block">
        &larr; All Field Manuals
      </Link>
      <div className="mb-6">
        <span className="font-mono text-sm text-gray-400">{fm.fm_number}</span>
        <h1 className="text-2xl font-bold mt-1">{fm.title}</h1>
        <p className="text-xs text-gray-400 mt-1">
          {fm.filename} &middot; {fm.word_count.toLocaleString()} words &middot;{" "}
          {fm.char_count.toLocaleString()} chars
        </p>
      </div>
      <div className="lg:grid lg:grid-cols-[1fr_16rem] lg:gap-8 lg:items-start">
        <article className="prose prose-sm max-w-none bg-white border border-gray-200 rounded p-6 overflow-auto prose-headings:scroll-mt-6 prose-table:text-xs prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-a:[&_.anchor]:no-underline">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
            ]}
          >
            {fm.content}
          </ReactMarkdown>
        </article>
        <Toc entries={fm.toc} />
      </div>
    </main>
  );
}
