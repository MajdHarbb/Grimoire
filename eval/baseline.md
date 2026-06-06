# Retrieval baseline — pure vector similarity

Re-recorded 2026-06-06 (evening), before hybrid search (roadmap item 2).
Corpus: Grimoire indexed on itself — 33 chunks, 16 files (re-ingested
2026-06-06 18:07; now includes scripts/eval.ts and eval/baseline.md).
Run: `npx tsx scripts/eval.ts`

```
            hit@1   hit@4   MRR
overall     9/15    14/15   0.728
semantic    4/8     7/8     0.635
keyword     5/7     7/7     0.833
```

Misses / weak spots:

- ✗ "How are text files split into overlapping pieces before embedding?"
  → `lib/rag.ts` not in top 10. The only hard failure.
- "How does the app compare two vectors for similarity?" → rank 4
  (was rank 1 on the 25-chunk index — eval.ts chunks now outrank it)
- "Where is cosineSimilarity implemented?" → rank 3 (keyword)
- "Which folders are skipped when scanning…" → rank 3
- "What does route.ts do?" / "Where are the embedded chunks saved…" → rank 2

Score calibration (for the I-don't-know guard, threshold 0.48):
real questions' best scores ≥ 0.509; nonsense probes ≤ 0.455.

## Lesson from the first baseline (morning, 25-chunk index)

The morning numbers (hit@1 11/15, MRR 0.833) were measured against a
25-chunk index. A mid-session re-ingest added eval.ts + baseline.md and
a longer CLAUDE.md, and several ranks shifted — e.g. the "compare two
vectors" question fell from rank 1 to 4 because eval.ts (which *talks
about* retrieval) now competes with rag.ts (which *implements* it).

Two takeaways:
1. Eval numbers are only comparable on the same index. Always re-run the
   baseline immediately before measuring a retrieval change.
2. Growing the corpus with files that discuss the same topics genuinely
   degrades semantic-only retrieval — a preview of the scale problem
   hybrid search (and exact keyword matching) is meant to address.
