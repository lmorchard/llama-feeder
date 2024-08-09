import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { pollAllFeeds } from "../feeds.js";

export default async function (program) {
  program
    .command("fetch")
    .description("Fetch latest items for subscribed feeds")
    .option("--force", "Force fetching feeds regardless of last fetch time")
    .action(commandFetch);
}

async function commandFetch(options) {
  const log = Logger.child({ name: "fetch" });
  const db = new Database();

  await pollAllFeeds(log, db,  {
    forceFetch: !!options.force,
    // TODO make these CLI options too?
    timeout: Config.get("fetchTimeout"),
    maxage: Config.get("feedPollMaxAge"),
    concurrency: Config.get("feedPollConcurrency"),
  });

  db.close();
}
