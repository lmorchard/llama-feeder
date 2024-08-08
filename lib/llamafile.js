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

  const responseData = await response.json();
  log.trace({ msg: "generateEmbeddings", responseData });

  const items = responseData.results
    ? responseData.results
    : [responseData];
  if (!items) {
    throw new Error("No results in embeddings response");
  }

  return items.map(r => r.embedding);
}

