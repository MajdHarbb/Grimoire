// scripts/ingest.ts
// OFFLINE, run once. Reads a code folder, chunks + embeds every file,
// and writes the searchable index to data/index.json.
// Usage: npx tsx scripts/ingest.ts ../some-project/src

import fs from "node:fs";
import path from "node:path";
import { chunk, type Chunk } from "../lib/rag";
import { embedBatch } from "../lib/embeddings";
import { saveStore, type StoredChunk } from "../lib/store";

// Which file types we treat as "code worth indexing".
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".md"];

// Recursively walk a directory and collect all code file paths.
// (Skips node_modules and hidden folders so we don't index junk.)
function findCodeFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
      return findCodeFiles(full); // recurse into subfolders
    }
    return CODE_EXTENSIONS.includes(path.extname(entry.name)) ? [full] : [];
  });
}

async function main() {
  const target = process.argv[2]; // the folder path you pass on the command line
  if (!target) {
    console.error("Usage: npx tsx scripts/ingest.ts <folder>");
    process.exit(1);
  }

  // 1. Find every code file.
  const files = findCodeFiles(path.resolve(target));
  console.log(`Found ${files.length} code files.`);

  // 2. Read + chunk each file. We store a path relative to the target
  //    as the `source`, so citations read like "src/auth/login.ts".
  const allChunks: Chunk[] = files.flatMap((file) => {
    const text = fs.readFileSync(file, "utf-8");
    const relative = path.relative(path.resolve(target), file);
    return chunk(text, relative);
  });
  console.log(`Split into ${allChunks.length} chunks.`);

  // 3. Embed every chunk's text in one batch call to Ollama.
  const vectors = await embedBatch(allChunks.map((c) => c.text));

  // 4. Zip chunks together with their vectors and save.
  const store: StoredChunk[] = allChunks.map((c, i) => ({
    ...c,
    embedding: vectors[i],
  }));
  saveStore(store);

  console.log(`Saved ${store.length} embedded chunks to data/index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});