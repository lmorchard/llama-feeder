import PQueue from "p-queue";

import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { fetchResource } from "../utils.js";
import {
  normalizeFeedCharset,
  parseFeedStream,
  itemDate,
  itemGuid,
} from "../feeds.js";

const MAX_ITEMS_TO_IMPORT = 100;

export default async function (program) {
  program
    .command("fetch")
    .description("Fetch latest items for subscribed feeds")
    .action(commandFetch);
}

async function commandFetch() {
  const log = Logger.child({ module: "cli", name: "commandImport" });
  const db = new Database();

  // TODO: make these CLI options
  const pollOptions = {
    force: false,
    timeout: Config.get("fetchTimeout"),
    maxage: Config.get("feedPollMaxAge"),
  };

  const feeds = db.listFeeds();
  log.info({ msg: "Fetching feeds", count: feeds.length });

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

async function pollFeed(feed, db, log, options = {}) {
  const { force = false, timeout = 20000, maxage = 30 * 60 * 1000 } = options;
  const { id, title, url, json = {}, lastValidated = 0 } = feed;
  const { headers: prevHeaders = {} } = json;
  const timeStart = Date.now();

  let updatedFeed = { ...feed };

  try {
    log.debug({ msg: "Starting poll", title, url });

    const age = timeStart - lastValidated;
    if (!force && lastValidated !== 0 && age < maxage) {
      log.info("Skipping poll for fresh feed %s (%s < %s)", title, age, maxage);
      return;
    }

    const response = await fetchResource({ url, prevHeaders, force, timeout });

    // Response headers are a Map - convert to plain object
    const headers = {};
    for (let [k, v] of response.headers) {
      headers[k] = v;
    }

    log.info(
      "Fetched feed (%s %s) %s",
      response.status,
      response.statusText,
      title
    );

    updatedFeed = {
      ...updatedFeed,
      lastValidated: timeStart,
      status: response.status,
      statusText: response.statusText,
      json: {
        ...updatedFeed.json,
        headers,
        fetchDuration: Date.now() - timeStart,
      },
    };

    if (response.status !== 200) {
      // This is most likely where we hit 304 Not Modified, so skip parsing.
      log.info(
        "Skipping parse for feed (%s %s) %s",
        response.status,
        response.statusText,
        title
      );
    } else {
      let { stream, charset } = normalizeFeedCharset(response, updatedFeed);
      const { meta, items } = await parseFeedStream({ stream, url });

      for (let rawItem of items.slice(0, MAX_ITEMS_TO_IMPORT)) {
        db.upsertFeedItem({
          ...rawItem,
          feedId: id,
          guid: itemGuid(rawItem),
          date: itemDate(rawItem),
          summary: rawItem.summary || rawItem.description,
          json: rawItem,
        });
      }

      updatedFeed = {
        ...updatedFeed,
        lastParsed: timeStart,
        json: {
          ...updatedFeed.json,
          meta,
          charset,
          parseDuration: Date.now() - timeStart,
        },
      };

      log.info("Parsed %s items for feed %s", items.length, title);
    }
  } catch (err) {
    log.error("Feed poll failed for %s - %s", title, err, err.stack);

    updatedFeed = {
      ...updatedFeed,
      lastValidated: timeStart,
      lastError: err,
      json: {
        ...updatedFeed.json,
        duration: Date.now() - timeStart,
      },
    };
  }

  db.updateFetchedFeed(updatedFeed);
}
