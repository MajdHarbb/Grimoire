"use client";

// app/page.tsx
// FRONTEND. The chat UI. Sends the question to /api/chat and renders the
// streamed answer live. "use client" because we use state + event handlers.

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./components/markdown";

// What the backend retrieved for an answer; n matches the [n] citations.
type Source = { n: number; file: string; score: number };

type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };

// Shown in the empty state; clicking one fills the composer.
const EXAMPLE_QUESTIONS = [
  "How does the app compare two vectors for similarity?",
  "What does ingest.ts do?",
  "How is the answer streamed to the browser?",
];

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content (capped in CSS via max-height).
  // Runs whenever the text changes — including when ask() clears it, which
  // shrinks the box back to one line.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto"; // reset so shrinking works too
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

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

      // Read the streamed bytes. The FIRST line is a JSON header with the
      // retrieved sources; everything after it is the answer text, which we
      // append to the last (assistant) message so it grows as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let headerParsed = false;
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!headerParsed) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) continue; // header not complete yet, keep buffering
          const header = JSON.parse(buffer.slice(0, nl)) as { sources: Source[] };
          buffer = buffer.slice(nl + 1); // the rest is answer text
          headerParsed = true;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { ...copy[copy.length - 1], sources: header.sources };
            return copy;
          });
        }

        accumulated += buffer;
        buffer = "";
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
      <header className="masthead">
        <span className="sigil">✦</span>
        <h1>Grimoire</h1>
        <p className="tagline">Ask your codebase anything.</p>
      </header>

      {/* Empty state: explain the name, offer starting questions.
          Disappears as soon as the first message exists. */}
      {messages.length === 0 && (
        <div className="hero">
          <div>
            <div className="hero-word">gri·moire</div>
            <div className="hero-phonetic">/ɡrim-ˈwär/ · noun</div>
          </div>
          <p className="hero-definition">a book of spells.</p>
          <p className="hero-sub">This one has read your code. Ask it anything.</p>
          <div className="suggestions">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button key={q} className="suggestion" onClick={() => setInput(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">{m.role === "user" ? "You" : "Grimoire"}</span>
              <div className="bubble">
                {m.role === "assistant" ? (
                  m.content ? (
                    <Markdown text={m.content} />
                  ) : loading && i === messages.length - 1 ? (
                    "…"
                  ) : (
                    ""
                  )
                ) : (
                  m.content
                )}
              </div>
              {/* The pages the answer was drawn from; [n] citations in the
                  text refer to these. Hover a chip to see its match score. */}
              {m.sources && (
                <div className="sources">
                  {m.sources.map((s) => (
                    <span key={s.n} className="source-chip" title={`similarity ${s.score}`}>
                      <span className="source-n">{s.n}</span> {s.file}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        {/* A textarea, not an input: an <input> can't hold a newline at all.
            Enter sends; Shift+Enter falls through to the default behavior,
            which in a textarea is inserting a line break. */}
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault(); // stop the newline that Enter would insert
              ask();
            }
          }}
          placeholder="e.g. What does cosineSimilarity do?"
        />
        <button onClick={ask} disabled={loading}>Ask</button>
      </div>
      <p className="hint">Enter ↵ to ask · Shift+Enter for a new line</p>
    </main>
  );
}