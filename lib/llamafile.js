import fetch from "node-fetch";

import { Config } from "./config.js";
import { Logger } from "./logger.js";

export async function generateEmbeddings(content) {
  const log = Logger.child({ name: "llamafile" });
  const apiUrl = Config.get("llamafileEmbeddingUrl");

  log.trace({ msg: "generateEmbeddings", content: content.length, apiUrl });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate embeddings: ${response.status}`);
  }

  const result = await response.json();
  if (!result.results) {
    throw new Error("No results in embeddings response");
  }

  return result.results.map(r => r.embedding);
}
