import type { StoredChunk } from "./store";

export type Chunk = {
  text: string;
  source: string;
};

export function chunk(
  text: string,
  source: string,
  maxChars = 1200,
  overlap = 200
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push({ text: text.slice(start, end), source });
    start += maxChars - overlap;
  }
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;     // running sum of a[i] * b[i]
  let normA = 0;   // running sum of a[i] squared
  let normB = 0;   // running sum of b[i] squared

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;  // guard divide-by-zero

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Given the question's vector and every stored chunk, return the top-k
// chunks ranked by similarity. This is the retrieval step: it decides
// WHICH pieces of code get fed to the LLM as context.
export function retrieve(
  queryEmbedding: number[],
  store: StoredChunk[],
  k = 4
): { chunk: StoredChunk; score: number }[] {
  return store
    .map((c) => ({ chunk: c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}