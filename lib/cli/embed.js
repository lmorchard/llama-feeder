import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { generateEmbeddings } from "../llamafile.js";

export default async function (program) {
  program
    .command("embed")
    .option("--batchsize <n>", "Number of items to process in each batch")
    .description("Backfill embeddings for feed items")
    .action(commandEmbed);
}

async function commandEmbed(options) {
  const { batchsize = 25 } = options;

  const log = Logger.child({ name: "embed" });
  const db = new Database();

  const feedItemIds = await db.listFeedItemIdsWithoutEmbeddings();
  if (feedItemIds.length === 0) {
    log.info({ msg: "No feed items without embeddings" });
    await db.close();
    return;
  }

  log.info({
    msg: "Generating embeddings",
    count: feedItemIds.length,
    batchsize,
  });

  for (let idx = 0; idx < feedItemIds.length; idx += batchsize) {
    log.info({ msg: "Processing batch", idx, batchsize });

    const feedItemIdBatch = feedItemIds.slice(idx, idx + batchsize);
    const feedItems = await db.fetchFeedItems(feedItemIdBatch);
    const content = feedItems.map(
      (item) => `${item.title}\n${item.link}\n\n${item.content}`
    );
    const embeddings = await generateEmbeddings(content);
    const items = feedItems.map((item, i) => ([item.id, embeddings[i]]));
    await db.insertFeedItemEmbeddings(items);
  }

  await db.close();
}
