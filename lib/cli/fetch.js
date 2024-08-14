import PQueue from "p-queue";

import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { pollAllFeeds, pollFeed } from "../feeds.js";
import { generateEmbeddingForFeedItemId } from "../llamafile.js";
import {
  backfillThumbnails,
  fetchThumbnailForFeedItemId,
} from "../thumbnails.js";

let db, log;

export default async function (program) {
  const fetchProgram = program
    .command("fetch")
    .description("Data fetching commands");

  fetchProgram.hook("preAction", async (command, subcommand) => {
    log = Logger.child({ name: subcommand.name() });
    db = new Database();
  });

  fetchProgram.hook("postAction", async () => {
    await db.close();
  });

  fetchProgram
    .command("all")
    .description("Fetch latest items and thumbnails for subscribed feeds")
    .option("--force", "Force fetching feeds regardless of last fetch time")
    .option("--thumbnails", "Fetch thumbnails for new feed items")
    .option("--embeddings", "Generate embeddings for new feed items")
    .action(commandFetchAll);

  fetchProgram
    .command("feeds")
    .description("Fetch latest items for subscribed feeds")
    .option("--force", "Force fetching feeds regardless of last fetch time")
    .action(commandFetchFeeds);

  fetchProgram
    .command("thumbnails")
    .description("Fetch thumbnails for new feed items")
    .action(commandFetchThumbnails);
}

async function commandFetchFeeds(options) {
  await pollAllFeeds(log, db, {
    forceFetch: !!options.force,
    // TODO make these CLI options too?
    timeout: Config.get("fetchTimeout"),
    maxage: Config.get("feedPollMaxAge"),
    concurrency: Config.get("feedPollConcurrency"),
  });
}

async function commandFetchThumbnails() {
  await backfillThumbnails(db, log);
}

async function commandFetchAll(options) {
  const { thumbnails: doThumbnails = false, embeddings: doEmbeddings = false } =
    options;

  const pollOptions = {
    forceFetch: !!options.force,
    // TODO make these CLI options too?
    timeout: Config.get("fetchTimeout"),
    maxage: Config.get("feedPollMaxAge"),
    concurrency: Config.get("feedPollConcurrency"),
  };

  const feedQueue = new PQueue({
    concurrency: pollOptions.concurrency | 4,
  });

  const thumbnailQueue = new PQueue({
    // TODO separate concurrency?
    concurrency: pollOptions.concurrency | 4,
  });

  const embeddingQueue = new PQueue({
    concurrency: 1,
  });

  const logQueueStatus = () => {
    log.info({
      msg: "Queue status",
      feedPendingCount: feedQueue.pending,
      feedQueuedCount: feedQueue.size,
      thumbnailPendingCount: thumbnailQueue.pending,
      thumbnailQueuedCount: thumbnailQueue.size,
      embeddingPendingCount: embeddingQueue.pending,
      embeddingQueuedCount: embeddingQueue.size,
    });
  };

  const queueStatusTimer = setInterval(logQueueStatus, 1000);

  const feeds = await db.listFeeds();

  log.info({ msg: "Fetching feeds", count: feeds.length, pollOptions });

  for (const feed of feeds) {
    feedQueue.add(
      async () => {
        const feedItemIds = await pollFeed(feed, db, log, pollOptions);
        logQueueStatus();

        if (feedItemIds) {
          for (const feedItemId of feedItemIds) {
            if (doThumbnails) {
              thumbnailQueue.add(async () => {
                await fetchThumbnailForFeedItemId(feedItemId, db, log);
                logQueueStatus();
              });
            }

            if (doEmbeddings) {
              embeddingQueue.add(async () => {
                await generateEmbeddingForFeedItemId(feedItemId, db, log);
                logQueueStatus();
              });
            }
          }
        }
      },
      { meta: feed.id }
    );
  }

  await feedQueue.onIdle();
  await thumbnailQueue.onIdle();
  await embeddingQueue.onIdle();

  clearInterval(queueStatusTimer);
}
