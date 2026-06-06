
// lib/embeddings.ts
// Turns text into vectors by calling your local Ollama server.
// Used in TWO places: the ingest script (embed all code chunks) and
// the chat route (embed the user's question). Same model both times.

const OLLAMA_URL = "http://localhost:11434/api/embed";
const EMBEDDING_MODEL = "nomic-embed-text"

// The shape of Ollama's JSON response. `embeddings` is always an array of
// vectors (an array of number-arrays), even when you send a single string.
type EmbedResponse = {
  embeddings: number[][];
};

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new Error(`Ollama embed failed: ${res.status} ${res.statusText}`);
  }

  const data: EmbedResponse = await res.json();
  return data.embeddings;
}

// Embed a SINGLE text. We'll use this in the chat route to embed the user's
// one question. It just wraps embedBatch and pulls out the first vector.
export async function embedOne(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding;
}