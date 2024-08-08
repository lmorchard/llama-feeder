import PQueue from "p-queue";

import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { pollFeed } from "../feeds.js";

export default async function (program) {
  program
    .command("fetch")
    .description("Fetch latest items for subscribed feeds")
    .option("--force", "Force fetching feeds regardless of last fetch time")
    .action(commandFetch);
}

async function commandFetch(options) {
  const log = Logger.child({ module: "cli", name: "commandImport" });
  const db = new Database();

  // TODO: make these CLI options
  const pollOptions = {
    forceFetch: !!options.force,
    timeout: Config.get("fetchTimeout"),
    maxage: Config.get("feedPollMaxAge"),
  };

  const fetchQueue = new PQueue({
    concurrency: Config.get("feedPollConcurrency"),
  });

  const queueStatusTimer = setInterval(() => {
    log.debug(
      "Fetch queue status (%s pending / %s queued)",
      fetchQueue.pending,
      fetchQueue.size
    );
  }, 1000);

  const feeds = await db.listFeeds();
  log.info({ msg: "Fetching feeds", count: feeds.length, pollOptions });

  await Promise.all(
    feeds.map((feed) =>
      fetchQueue.add(() => pollFeed(feed, db, log, pollOptions), {
        meta: feed.title,
      })
    )
  );

  clearInterval(queueStatusTimer);
  db.close();
}
