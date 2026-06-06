// lib/embeddings.test.ts — throwaway, delete after
import { embedOne } from "./embeddings";

embedOne("function authenticate(user) { return checkPassword(user); }")
  .then((vec) => {
    console.log("Vector length:", vec.length);
    console.log("First 5 numbers:", vec.slice(0, 5));
  })
  .catch((err) => console.error("Failed:", err));