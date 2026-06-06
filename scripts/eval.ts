// scripts/eval.ts
// Measures retrieval quality: for each question in eval/cases.json, does
// retrieve() rank a chunk from the expected source file near the top?
// Retrieval-only — the generation model is never called, so results are
// deterministic and the run is cheap (one batched embed call).
// Usage: npx tsx scripts/eval.ts

import fs from "node:fs";
import path from "node:path";
import { retrieve } from "../lib/rag";
import { embedBatch } from "../lib/embeddings";
import { loadStore } from "../lib/store";

type EvalCase = {
  question: string;
  expectedSource: string;
  type: "semantic" | "keyword";
};

// How deep we search for the expected file. Bigger than the production k=4
// so we can see *where* a file ranks even when it misses the top 4 — that
// rank feeds MRR, which detects partial improvements Hit@4 can't.
const RANK_DEPTH = 10;

// The k the chat route actually uses (app/api/chat/route.ts). Hit@4 answers
// "would the LLM have seen the right file?"
const PRODUCTION_K = 4;

type CaseResult = EvalCase & {
  rank: number | null; // 1-based rank of the first chunk from the expected file, null = not in top RANK_DEPTH
};

function summarize(results: CaseResult[]) {
  const n = results.length;
  const hitAt = (k: number) =>
    results.filter((r) => r.rank !== null && r.rank <= k).length;
  // Mean reciprocal rank: 1/rank, or 0 if the file wasn't found at all.
  // (Truncated at RANK_DEPTH — a file at rank 11+ scores 0, which is fine
  // since rank 11 and rank 100 are equally useless to a k=4 retriever.)
  const mrr =
    results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / n;
  return {
    hit1: `${hitAt(1)}/${n}`,
    hit4: `${hitAt(PRODUCTION_K)}/${n}`,
    mrr: mrr.toFixed(3),
  };
}

async function main() {
  const casesPath = path.join(process.cwd(), "eval", "cases.json");
  const cases: EvalCase[] = JSON.parse(fs.readFileSync(casesPath, "utf-8"));
  const store = loadStore();

  // Sanity check: the eval only means something if the index actually
  // contains the files the cases expect. Catches a stale or foreign index.
  const indexedSources = new Set(store.map((c) => c.source));
  const missing = cases.filter((c) => !indexedSources.has(c.expectedSource));
  if (missing.length > 0) {
    console.error("ERROR: expected sources not present in data/index.json:");
    for (const m of missing) console.error(`  - ${m.expectedSource}`);
    console.error("Re-ingest the right folder (npx tsx scripts/ingest.ts .) and retry.");
    process.exit(1);
  }

  // Embed every question in one batch. embedOne() (what the chat route uses)
  // is just embedBatch() with a single input, so this measures exactly what
  // production does — only faster.
  const questionVectors = await embedBatch(cases.map((c) => c.question));

  const results: CaseResult[] = cases.map((c, i) => {
    const hits = retrieve(questionVectors[i], store, RANK_DEPTH);
    const idx = hits.findIndex((h) => h.chunk.source === c.expectedSource);
    return { ...c, rank: idx === -1 ? null : idx + 1 };
  });

  // Per-case table: one line per question so a before/after diff is readable.
  console.log("");
  for (const r of results) {
    const mark = r.rank !== null && r.rank <= PRODUCTION_K ? "✓" : "✗";
    const rank = r.rank === null ? `not in top ${RANK_DEPTH}` : `rank ${r.rank}`;
    console.log(
      `${mark} [${r.type.padEnd(8)}] ${rank.padEnd(13)} ${r.expectedSource.padEnd(25)} ${r.question}`
    );
  }

  // Summary: overall plus the semantic/keyword split. Hybrid search should
  // lift the keyword row without dropping the semantic row.
  console.log("");
  console.log(`            hit@1   hit@${PRODUCTION_K}   MRR`);
  for (const [label, group] of [
    ["overall", results],
    ["semantic", results.filter((r) => r.type === "semantic")],
    ["keyword", results.filter((r) => r.type === "keyword")],
  ] as const) {
    const s = summarize(group);
    console.log(`${label.padEnd(10)}  ${s.hit1.padEnd(7)} ${s.hit4.padEnd(7)} ${s.mrr}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
