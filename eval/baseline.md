# Retrieval baseline — pure vector similarity

Recorded 2026-06-06, before hybrid search (roadmap item 2).
Corpus: Grimoire indexed on itself (25 chunks, 14 files).
Run: `npx tsx scripts/eval.ts`

```
            hit@1   hit@4   MRR
overall     11/15   14/15   0.833
semantic    6/8     7/8     0.813
keyword     5/7     7/7     0.857
```

Misses / weak spots:

- ✗ "How are text files split into overlapping pieces before embedding?"
  → `lib/rag.ts` not in top 10. The only hard failure.
- "Where is cosineSimilarity implemented?" → rank 2 (keyword, should be 1)
- "What does route.ts do?" → rank 2 (keyword, should be 1)
- "Where are the embedded chunks saved to disk and loaded back?" → rank 2

Caveat: at 14 files the corpus is small enough that semantic similarity
alone finds most keyword targets — the keyword group is already 7/7 at
hit@4. Headroom for hybrid search to demonstrate: keyword hit@1 (5/7),
overall MRR, and the one hard semantic miss.
