/**
 * Text embedding for memory storage.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Falls back to null if OPENAI_API_KEY not set — memory write still succeeds,
 * but without embedding (similarity search won't find it).
 */

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.warn("[embeddings] OPENAI_API_KEY not set — skipping embedding");
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // API limit
      }),
    });

    if (!res.ok) {
      console.error(`[embeddings] API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as EmbeddingResponse;
    return data.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embeddings] Error:", err);
    return null;
  }
}
