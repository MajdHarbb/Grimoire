// lib/ollama.ts
// Calls llama3.2 via Ollama's /api/chat and yields the answer token-by-token.
// Used by the chat route to stream a reply to the browser as it's generated.

const OLLAMA_CHAT_URL = "http://localhost:11434/api/chat";
const CHAT_MODEL = "llama3.2";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// An async generator: it produces a sequence of string pieces over time.
// `AsyncGenerator<string>` is the type — "yields strings, asynchronously".
// The caller can `for await (const piece of generate(...))` to consume them.
export async function* generate(messages: ChatMessage[]): AsyncGenerator<string> {
  const res = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama chat failed: ${res.status} ${res.statusText}`);
  }

  // Ollama streams NDJSON: one JSON object per line. We read the raw bytes,
  // decode to text, and split on newlines. A `buffer` holds any partial line
  // left over between network chunks (a line can be split across reads).
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // last item may be an incomplete line; keep it

    for (const line of lines) {
      if (!line.trim()) continue;
      const json = JSON.parse(line);
      const piece = json.message?.content;
      if (piece) yield piece; // hand this fragment of the answer to the caller
      if (json.done) return;
    }
  }
}