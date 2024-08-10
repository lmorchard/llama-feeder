import fetch from "node-fetch";

import { Config } from "./config.js";
import { Logger } from "./logger.js";

export async function generateEmbeddingsBatch(content) {
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

  const items = responseData.results ? responseData.results : [responseData];
  if (!items) {
    throw new Error("No results in embeddings response");
  }

  return items.map((r) => r.embedding);
}

export const getEmbedContentForFeedItem = (item) =>
  `${item.title}\n${item.link}\n\n${item.content}`;

export async function generateEmbeddingForFeedItemId(id, db, log) {
  const feedItem = db.fetchFeedItemById(id);
  if (!feedItem) return;

  const content = getEmbedContentForFeedItem(feedItem);
  const [embedding] = await generateEmbeddingsBatch([content]);
  return await db.insertFeedItemEmbeddings([[id, embedding]]);
}
