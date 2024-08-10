import { Option } from "commander";

import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { generateEmbeddings } from "../llamafile.js";

let db, log;

const WITHIN_MAXAGES = {
  hour: 1000 * 60 * 60,
  halfday: 1000 * 60 * 60 * 12,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
  month: 1000 * 60 * 60 * 24 * 30,
  year: 1000 * 60 * 60 * 24 * 365,
};

export default async function (program) {
  const embedProgram = program
    .command("embed")
    .description("Embedding management commands");

  embedProgram.hook("preAction", async (command, subcommand) => {
    log = Logger.child({ name: `embed:${subcommand.name()}` });
    db = new Database();
  });

  embedProgram.hook("postAction", async () => {
    await db.close();
  });

  embedProgram
    .command("backfill")
    .option("--batchsize <n>", "Number of items to process in each batch")
    .description("Backfill embeddings for feed items")
    .action(commandBackfill);

  embedProgram
    .command("search <query>")
    .option("--limit <n>", "Maximum number of results to return")
    .option("--maxage <ms>", "Only return results newer than this age (in ms)")
    .addOption(
      new Option(
        "--within <span>",
        "Only return results newer than this named timespan"
      ).choices(Object.keys(WITHIN_MAXAGES))
    )
    .description("Simple search for feed items via embeddings")
    .action(commandSearch);
}

async function commandBackfill(options) {
  const { batchsize = 25 } = options;

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
    const items = feedItems.map((item, i) => [item.id, embeddings[i]]);
    await db.insertFeedItemEmbeddings(items);
  }
}

async function commandSearch(query, options) {
  const { limit = 10, within } = options;

  let maxage = options.maxage || 1000 * 60 * 60 * 24;

  if (within) {
    maxage = WITHIN_MAXAGES[within];
  }

  log.info({ msg: "Searching for feed items", query, maxage });

  const content = [query];
  const embeddings = await generateEmbeddings(content);
  const embedding = embeddings[0];

  const ids = await db.findFeedItemIdsByEmbedding({ embedding, limit, maxage });
  const items = await db.fetchFeedItemsByIds(ids);

  for (let item of items) {
    const { title, link, date /*, content*/ } = item;
    const dateParsed = new Date();
    dateParsed.setTime(date);
    log.info({ dateParsed, title, link /*, content*/ });
  }
}
