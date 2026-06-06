# UI/UX Uplift — Design

Date: 2026-06-06. Approved direction: **modern arcane** — keep the dark
mystical identity, execute it with modern-product polish. "Epic and modern
at the same time."

## Scope

In: visual restyle, multi-line composer, alive loading, name explanation,
markdown rendering, source chips, copy-to-clipboard, "I don't know" guard.
Out: hybrid search (roadmap item 2 — deliberately reordered after this),
chat history, multi-conversation.

## 1. Visual language

- Typography: Cormorant Garamond for the title/ritual copy only; Geist Sans
  (already loaded in layout.tsx, currently unused) for all UI text;
  JetBrains Mono for code only.
- Depth instead of lines: 14–16px radii, translucent layered surfaces
  (rgba + backdrop-filter), faint gradient borders, subtle ember glow on
  answer-card top edges.
- Living background: existing candlelight radials plus a slow-drifting
  layer and faint grain so the void isn't flat black.
- Motion: message rise-in, streaming caret ▍, smooth auto-scroll (new).

## 2. Empty state — the name explained

When no messages: dictionary-style hero —
"**gri·moire** /ɡrim-ˈwär/ — *a book of spells.* This one has read your
code." — plus 3 clickable example questions that fill the composer.
Dismissed by the first message.

## 3. Composer

Root cause of the line-break bug: single-line `<input>` (cannot hold \n)
and `e.key === "Enter" && ask()` with no modifier check. Fix: auto-growing
`<textarea>` (1→6 rows); Enter sends, Shift+Enter inserts newline; hint
line below; rounded glowing send button.

## 4. Alive loading — three honest phases

1. Casting: pulsing sigil ✦ + cycling status ("Consulting the grimoire…").
2. Sources arrive (retrieval done, before llama's slow first token): chips
   render immediately, status becomes "Reading lib/rag.ts…".
3. Streaming: text flows with the caret.

## 5. Markdown rendering

Hand-rolled mini-renderer (~80 lines, no deps): code blocks, inline code,
bold/italic, lists, paragraphs. Chosen over react-markdown to match the
project's hand-written ethos; tradeoff: exotic markdown won't render,
which llama3.2 rarely emits anyway.

## 6. Source chips — stream protocol change

route.ts sends one JSON line first:
`{"sources":[{"n":1,"file":"lib/rag.ts","score":0.78},…]}\n`
then the plain text stream as before. Frontend buffers to the first
newline, parses the header, renders chips, streams the rest. No SSE
machinery; fully legible.

## 7. Copy-to-clipboard

Hover button on assistant bubbles; copies raw answer text; flashes ✓.

## 8. "I don't know" guard — calibrated threshold

If the best retrieval score is below a threshold, the route streams a
themed refusal instead of letting llama improvise. The threshold is not a
magic number: extend scripts/eval.ts to print best scores per question,
probe a few nonsense questions, and place the threshold in the gap between
the two distributions.

## Commit sequence

design doc → theme foundation → composer → markdown renderer → sources
protocol + chips → alive loading → copy button → IDK guard + calibration.
