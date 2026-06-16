// src/lib/embed.ts
// Provider-agnostic text embeddings for semantic retrieval.
//
// Default: OpenAI `text-embedding-3-small` (1536-d). Set EMBED_PROVIDER=voyage
// to use Voyage AI (Anthropic's recommended embeddings provider). The model's
// dimension MUST match the `vector(N)` column in drizzle/0002_pgvector.sql —
// if you change the model, change the migration's dimension too.
//
// Env:
//   EMBED_PROVIDER   "openai" (default) | "voyage"
//   EMBED_MODEL      override the model name
//   OPENAI_API_KEY   required for openai
//   VOYAGE_API_KEY   required for voyage

const PROVIDER = (process.env.EMBED_PROVIDER || "openai").toLowerCase();
const MODEL =
  process.env.EMBED_MODEL ||
  (PROVIDER === "voyage" ? "voyage-3.5-lite" : "text-embedding-3-small");

interface EmbeddingResponse {
  data: { embedding: number[] }[];
}

async function post(
  url: string,
  key: string,
  body: Record<string, unknown>,
): Promise<number[][]> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Embeddings request failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as EmbeddingResponse;
  return json.data.map((d) => d.embedding);
}

/** Embed a batch of texts. Order of the result matches the input order. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (PROVIDER === "voyage") {
    const key = process.env.VOYAGE_API_KEY;
    if (!key) throw new Error("VOYAGE_API_KEY is not set");
    return post("https://api.voyageai.com/v1/embeddings", key, {
      model: MODEL,
      input: texts,
    });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return post("https://api.openai.com/v1/embeddings", key, {
    model: MODEL,
    input: texts,
  });
}

/** Embed a single text. */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}
