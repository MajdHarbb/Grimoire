"use client";

// app/page.tsx
// FRONTEND. The chat UI. Sends the question to /api/chat and renders the
// streamed answer live. "use client" because we use state + event handlers.

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    const question = input.trim();
    if (!question || loading) return;

    // Show the user's message immediately, clear the box, add an empty
    // assistant message we'll fill in as tokens stream.
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.body) throw new Error("No response stream");

      // Read the streamed bytes, decode to text, and append each piece to
      // the last (assistant) message so it grows on screen as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: accumulated };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1].content = `Error: ${String(err)}`;
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="chat">
      <h1>Grimoire</h1>
      <p className="tagline">Ask your codebase anything.</p>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="who">{m.role === "user" ? "You" : "Grimoire"}</span>
            <div className="bubble">{m.content || (loading && i === messages.length - 1 ? "…" : "")}</div>
          </div>
        ))}
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. What does cosineSimilarity do?"
        />
        <button onClick={ask} disabled={loading}>Ask</button>
      </div>
    </main>
  );
}