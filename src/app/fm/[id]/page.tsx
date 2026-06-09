import { db } from "@/db";
import { fieldManuals } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

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

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
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
      <article className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed bg-white border border-gray-200 rounded p-6 overflow-auto">
        {fm.content}
      </article>
    </main>
  );
}
