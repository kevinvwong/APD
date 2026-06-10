// src/lib/ask-prompt.ts
// Shared prompt construction + types for the doctrine assistant.

import type { Section } from "./retrieve";

export type AskMode = "library" | "open";
export interface ChatTurn { role: "user" | "assistant"; text: string }

export function buildPrompt(question: string, sources: Section[], history: ChatTurn[], mode: AskMode): string {
  const ctx = sources.length
    ? sources.map((s, i) => `[${i + 1}] ${s.n} \u2014 ${s.ft}${s.c ? " > " + s.c : ""} > ${s.h}\n${s.b}`).join("\n\n")
    : "(no closely matching excerpts were found in the library)";
  const hist = history.length
    ? "Earlier in this conversation:\n" + history.map((m) => (m.role === "user" ? "Q: " : "A: ") + m.text).join("\n") + "\n\n"
    : "";

  if (mode === "open") {
    return (
      `You are a knowledgeable U.S. Army doctrine assistant with access to a library of official Field Manuals (FMs). ` +
      `Answer the QUESTION.\n` +
      `- You may draw on your own expertise in addition to the reference excerpts below.\n` +
      `- When a statement is directly supported by a provided excerpt, cite it with the excerpt number in brackets, e.g. [1].\n` +
      `- If you state something that goes beyond the provided excerpts, make clear it is general knowledge and may not match the exact manual wording.\n` +
      `- Be concise and authoritative.\n\n` +
      hist + `REFERENCE EXCERPTS (from the FM library; may be partial):\n${ctx}\n\nQUESTION: ${question}`
    );
  }
  return (
    `You are a U.S. Army doctrine research assistant for a library of official Field Manuals (FMs). ` +
    `Answer the QUESTION using ONLY the numbered EXCERPTS below.\n` +
    `Rules:\n` +
    `- Cite every claim with excerpt number(s) in square brackets, e.g. [1] or [2,4].\n` +
    `- If the excerpts do not contain the answer, say you could not find it in the indexed manuals. Never invent doctrine or cite a manual that is not listed.\n` +
    `- Be concise and authoritative: one short paragraph or a few bullet points.\n\n` +
    hist + `EXCERPTS:\n${ctx}\n\nQUESTION: ${question}`
  );
}
