// lib/store.ts
// Our "database" — a JSON file holding every chunk plus its vector.
// saveStore(): called once by the ingest script.
// loadStore(): called by the chat backend on each question to search against.

import fs from "node:fs";
import path from "node:path";
import type { Chunk } from "./rag";

// A stored chunk is a Chunk (text + source) PLUS its embedding vector.
// `&` is a TS intersection: "a StoredChunk has everything a Chunk has,
// and additionally an embedding field." This is the exact record we search.
export type StoredChunk = Chunk & {
  embedding: number[];
};

const STORE_PATH = path.join(process.cwd(), "data", "index.json");

export function saveStore(store: StoredChunk[]): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), "utf-8");
}

export function loadStore(): StoredChunk[] {
  if (!fs.existsSync(STORE_PATH)) {
    throw new Error("No index found. Run the ingest script first.");
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as StoredChunk[];
}