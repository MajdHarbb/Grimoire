// app/api/chat/route.ts
// BACKEND. The single endpoint the chat UI calls. Runs the full RAG query:
// embed question -> retrieve relevant code -> prompt llama3.2 -> stream answer.

import { embedOne } from "@/lib/embeddings";
import { retrieve } from "@/lib/rag";
import { loadStore } from "@/lib/store";
import { generate } from "@/lib/ollama";

// Force the Node.js runtime: we read a file from disk (the store), which the
// lighter "edge" runtime can't do.
export const runtime = "nodejs";

export async function POST(req: Request) {
  // 1. Get the question from the request body the frontend sends.
  const { question } = await req.json();

  // 2. Embed the question into a vector (same model used for the code).
  const queryEmbedding = await embedOne(question);

  // 3. Retrieve the most relevant code chunks using YOUR cosineSimilarity.
  const store = loadStore();
  const hits = retrieve(queryEmbedding, store, 4);

  // 4. Build the context block, numbering each chunk and labelling its file.
  //    The numbers + filenames are what let the model cite sources.
  const context = hits
    .map((h, i) => `[${i + 1}] from ${h.chunk.source}:\n${h.chunk.text}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You answer questions about a codebase using ONLY the context below.
Each context block is numbered and labelled with its source file.
When you use information from a block, cite it inline like [1] or [2].
Use the provided code context to answer. Explain what the code does, even if you have to reason about it. Only say you don't know if the context truly contains nothing relevant. When you use a block, cite it like [1].
CONTEXT:
${context}`;

  // 5. Stream llama's answer back to the browser as it's generated.
  //    We wrap YOUR generate() generator in a Web ReadableStream, which is
  //    what a Response can stream from.
  // The retrieved sources, in the same order as the numbered context blocks,
  // so "[2]" in the answer text refers to sources[1] in this list.
  const sources = hits.map((h, i) => ({
    n: i + 1,
    file: h.chunk.source,
    score: Number(h.score.toFixed(3)),
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Stream protocol: ONE JSON line first ({"sources":[...]}\n), then the
      // raw answer text. The frontend buffers up to the first newline, parses
      // the header, and renders everything after it as the streamed answer.
      // This also means the chips appear BEFORE llama's slow first token —
      // the UI can show "reading lib/rag.ts…" while the model warms up.
      controller.enqueue(encoder.encode(JSON.stringify({ sources }) + "\n"));
      try {
        for await (const piece of generate([
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ])) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[error: ${String(err)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}