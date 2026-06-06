// app/components/markdown.tsx
// A small hand-rolled markdown renderer for the model's answers. Handles
// exactly what llama3.2 actually emits — fenced code blocks, inline code,
// bold/italic, lists, small headings, paragraphs — and nothing more.
// Written by hand instead of pulling in react-markdown so every line here
// is understandable; the tradeoff is that exotic markdown (tables, nested
// lists) renders as plain text.

import type { ReactNode } from "react";

// ---- inline level: `code`, **bold**, *italic* inside a line of text ----

// One regex with alternatives; split() keeps the delimiters because the
// pattern is wrapped in a capture group. Even indices are plain text,
// odd indices are the matched tokens.
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{renderInline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{renderInline(part.slice(1, -1))}</em>;
    }
    return part;
  });
}

// ---- block level: walk the lines, grouping them into blocks ----

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block. While streaming, the closing ``` may not have
    // arrived yet — then we just take everything to the end, so the block
    // renders as code from the moment it opens instead of flickering.
    if (line.startsWith("```")) {
      let end = i + 1;
      while (end < lines.length && !lines[end].startsWith("```")) end++;
      blocks.push(
        <pre key={i}>
          <code>{lines.slice(i + 1, end).join("\n")}</code>
        </pre>
      );
      i = end + 1; // skip past the closing fence (or the end)
      continue;
    }

    // Unordered list: consecutive lines starting with "- " or "* ".
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push(
        <ul key={i}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list: consecutive lines starting with "1. ", "2. ", ...
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]))
        items.push(lines[i++].replace(/^\d+\. /, ""));
      blocks.push(
        <ol key={i}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading (the model occasionally emits ### sections).
    const heading = line.match(/^(#{1,3}) (.*)/);
    if (heading) {
      blocks.push(
        <p key={i} className="md-heading">
          {renderInline(heading[2])}
        </p>
      );
      i++;
      continue;
    }

    // Blank line: block separator, nothing to render.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: consecutive ordinary lines. Newlines inside are kept
    // (CSS pre-wrap) because the model's line breaks are usually deliberate.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^#{1,3} /.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(<p key={i}>{renderInline(para.join("\n"))}</p>);
  }

  return <div className="md">{blocks}</div>;
}
