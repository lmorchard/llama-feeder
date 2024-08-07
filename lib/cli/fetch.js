import crypto from "crypto";
import PQueue from "p-queue";

import { Iconv } from "iconv";
import FeedParser from "feedparser";

import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { fetchResource } from "../utils.js";

const MAX_ITEMS_TO_IMPORT = 100;
const DEFAULT_FEED_CHARSET = "utf-8";

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
    log.info(
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
      let { stream, charset } = normalizeFeedCharset(
        response,
        updatedFeed,
        log,
        title
      );
      const { meta, items } = await parseFeedStream({ stream, url });

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

function normalizeFeedCharset(response, feed, log, title) {
  let charset = detectCharsetFromFeed(response, feed);
  let stream = response.body;
  if (charset && !/utf-*8/i.test(charset)) {
    const iconv = new Iconv(charset, "utf-8");
    log.debug("Converting from charset %s to utf-8 for %s", charset, title);
    stream = stream.pipe(iconv);
  }
  return { stream, charset };
}

function detectCharsetFromFeed(response, feed) {
  const contentType = response.headers.get("content-type");
  const contentTypeParams = getParams(contentType || "");
  let charset = contentTypeParams.charset;

  if (!charset && feed.json.charset) {
    // HACK: Try to guess a charset from previous parsing
    // Maybe we need to do a speculative parsing instead to
    // get XML encoding from doctype?
    let prevCharset = feed.json.charset;
    if (!prevCharset) {
      prevCharset = feed.json.meta["#xml"].encoding;
    }
    charset = prevCharset;
  }

  if (!charset) {
    charset = DEFAULT_FEED_CHARSET;
  }
  return charset;
}

function parseFeedStream({ stream, url }) {
  return new Promise((resolve, reject) => {
    let meta;
    const items = [];

    const parser = new FeedParser({
      addmeta: false,
      feedurl: url,
    });

    parser.on("error", reject);
    parser.on("end", () => resolve({ meta, items }));
    parser.on("readable", function () {
      meta = this.meta;
      let item;
      while ((item = this.read())) {
        items.push(item);
      }
    });

    stream.pipe(parser);
  });
}

function getParams(str) {
  var params = str.split(";").reduce(function (params, param) {
    var parts = param.split("=").map(function (part) {
      return part.trim();
    });
    if (parts.length === 2) {
      params[parts[0]] = parts[1];
    }
    return params;
  }, {});
  return params;
}

// Relevant date for an item has a bit of variance, so let's
// work with some fallbacks. Also, treat future dates as *now*,
// since I've seen a few feeds behave badly that way.
const itemDate = ({ date, pubdate } = {}) => {
  const now = new Date();
  const candidate = new Date(date || pubdate || now);
  return candidate < now ? candidate : now;
};

// Some items don't have a guid, so let's use a hash of the
// title & link as a rough fallback
const itemGuid = ({ guid, title = "", link = "" }) =>
  guid || crypto.createHash("md5").update(title).update(link).digest("hex");
