// /library — signed-in user's saved content dashboard
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  conversations,
  messages,
  userBookmarks,
  userRecents,
  userHighlights,
  sources,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { LibraryClient } from "@/components/LibraryClient";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [convos, bookmarks, recents, highlights, starred] = await Promise.all([
    db
      .select({
        id: conversations.id,
        fm_id: conversations.fm_id,
        title: conversations.title,
        mode: conversations.mode,
        updated_at: conversations.updated_at,
        message_count: sql<number>`(SELECT count(*) FROM ${messages} WHERE ${messages.conversation_id} = ${conversations.id})`,
        fm_number: sources.fm_number,
        fm_title: sources.title,
      })
      .from(conversations)
      .leftJoin(sources, eq(conversations.fm_id, sources.id))
      .where(eq(conversations.user_id, userId))
      .orderBy(desc(conversations.updated_at))
      .limit(50),

    db
      .select({
        id: userBookmarks.id,
        fm_id: userBookmarks.fm_id,
        anchor: userBookmarks.anchor,
        note: userBookmarks.note,
        created_at: userBookmarks.created_at,
        fm_number: sources.fm_number,
        fm_title: sources.title,
      })
      .from(userBookmarks)
      .leftJoin(sources, eq(userBookmarks.fm_id, sources.id))
      .where(eq(userBookmarks.user_id, userId))
      .orderBy(desc(userBookmarks.created_at)),

    db
      .select({
        fm_id: userRecents.fm_id,
        last_anchor: userRecents.last_anchor,
        last_read_at: userRecents.last_read_at,
        fm_number: sources.fm_number,
        fm_title: sources.title,
      })
      .from(userRecents)
      .leftJoin(sources, eq(userRecents.fm_id, sources.id))
      .where(eq(userRecents.user_id, userId))
      .orderBy(desc(userRecents.last_read_at))
      .limit(20),

    db
      .select({
        id: userHighlights.id,
        fm_id: userHighlights.fm_id,
        anchor: userHighlights.anchor,
        selected_text: userHighlights.selected_text,
        note: userHighlights.note,
        color: userHighlights.color,
        created_at: userHighlights.created_at,
        fm_number: sources.fm_number,
        fm_title: sources.title,
      })
      .from(userHighlights)
      .leftJoin(sources, eq(userHighlights.fm_id, sources.id))
      .where(eq(userHighlights.user_id, userId))
      .orderBy(desc(userHighlights.created_at))
      .limit(200),

    db
      .select({
        id: messages.id,
        conversation_id: messages.conversation_id,
        text: messages.text,
        created_at: messages.created_at,
        fm_id: conversations.fm_id,
        fm_number: sources.fm_number,
        fm_title: sources.title,
        conversation_title: conversations.title,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .leftJoin(sources, eq(conversations.fm_id, sources.id))
      .where(
        and(
          eq(conversations.user_id, userId),
          eq(messages.starred, true),
          eq(messages.role, "assistant"),
        ),
      )
      .orderBy(desc(messages.created_at))
      .limit(100),
  ]);

  return (
    <LibraryClient
      conversations={convos}
      bookmarks={bookmarks}
      recents={recents}
      highlights={highlights}
      starred={starred}
    />
  );
}
