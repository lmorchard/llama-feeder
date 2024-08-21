import crypto from "crypto";
import { Iconv } from "iconv";
import PQueue from "p-queue";
import FeedParser from "feedparser";
import { Config } from "./config.js";
import { fetchResource } from "./utils.js";

export async function pollAllFeeds(log, db, pollOptions) {
  const fetchQueue = new PQueue({
    concurrency: pollOptions.concurrency | 4,
  });

  const queueStatusTimer = setInterval(() => {
    log.debug({
      msg: "Fetch queue status",
      pendingCount: fetchQueue.pending,
      queuedCount: fetchQueue.size,
    });
  }, 1000);

  const feeds = await db.listFeeds();
  log.info({ msg: "Fetching feeds", count: feeds.length, pollOptions });

  await Promise.all(
    feeds.map((feed) =>
      fetchQueue.add(() => pollFeed(feed, db, log, pollOptions), {
        meta: feed.id,
      })
    )
  );

  clearInterval(queueStatusTimer);
}

export async function pollFeed(feed, db, log, options = {}) {
  const {
    forceFetch = false,
    timeout = 20000,
    maxage = 30 * 60 * 1000,
  } = options;

  const { id: feedId, disabled = false, title, url, metadata = {} } = feed;
  const { lastFetched = 0, lastHeaders = {} } = metadata;

  const timeStart = Date.now();
  const feedUpdates = { id: feedId, url, metadata };
  const logCommon = { feedId, title, url };

  const feedItemIds = [];

  try {
    log.debug({ msg: "Feed poll start", ...logCommon });

    if (disabled) {
      log.info({ msg: "Feed poll skipped", ...logCommon, disabled });
      return;
    }

    const age = timeStart - lastFetched;
    if (!forceFetch && lastFetched !== 0 && age < maxage) {
      log.info({
        msg: "Feed poll skipped",
        ...logCommon,
        age,
        maxage,
      });
      return;
    }

    const response = await fetchResource({
      url,
      lastHeaders,
      forceFetch,
      timeout,
    });
    Object.assign(feedUpdates.metadata, {
      lastFetched: Date.now(),
      lastStatus: response.status,
      lastStatusText: response.statusText,
      lastHeaders: response.headers.raw(),
    });
    log.info({
      msg: "Fetched feed",
      status: response.status,
      statusText: response.statusText,
      ...logCommon,
    });

    if (response.status !== 200) {
      // This is most likely where we hit 304 Not Modified, so skip parsing.
      log.info({ msg: "Feed parse skipped", ...logCommon });
    } else {
      let { stream, charset } = normalizeFeedCharset(response, feedUpdates);
      const { meta, items } = await parseFeedStream({ stream, url });

      // Update feed metadata fields with select parsed feed metadata
      const { title, description, link } = { ...feedUpdates, ...meta };
      log.debug({ msg: "Feed metadata update", ...logCommon, title, description, link });
      Object.assign(feedUpdates, { title, description, link });

      const existingGuids = new Set(await db.fetchFeedItemGuids(feedId));
      const seenGuids = new Set();

      const itemsToUpsert = [];
      let newestItemDate = undefined;
      for (let rawItem of items.slice(0, Config.get("feedPollMaxItems"))) {
        const { title, link, author, summary, description, content } = rawItem;

        const date = itemDate(rawItem);
        const guid = itemGuid(rawItem);

        // Track seen GUIDs to detect new & defunct items
        seenGuids.add(guid);

        // Skip items we've already stored, so as not to bump dates
        if (existingGuids.has(guid)) continue;

        if (!newestItemDate || date > newestItemDate) newestItemDate = date;

        itemsToUpsert.push({
          feedId,
          guid,
          date,
          title,
          link,
          author,
          content: content || description || summary,
          // Store raw item as metadata to preserve fields not captured as columns
          metadata: rawItem,
        });
      }

      // Annotate items with dates of when first seen and when last seen in feed
      const newGuids = seenGuids.difference(existingGuids);
      const defunctGuids = existingGuids.difference(seenGuids);
      for (let item of itemsToUpsert) {
        if (defunctGuids.has(item.guid)) item.lastSeenAt = Date.now();
        if (newGuids.has(item.guid)) item.firstSeenAt = Date.now();
      }

      // Finally, upsert all the new items.
      feedItemIds.push(
        ...(await Promise.all(
          itemsToUpsert.map((item) => db.upsertFeedItem(item))
        ))
      );

      if (newestItemDate) {
        feedUpdates.newestItemDate = newestItemDate;
      }

      Object.assign(feedUpdates.metadata, {
        charset,
        feedMeta: meta,
        lastParsed: Date.now(),
        parseDuration: Date.now() - timeStart,
      });

      log.info({
        msg: "Feed parse complete",
        ...logCommon,
        itemCount: items.length,
        seenCount: seenGuids.size,
        existingCount: existingGuids.size,
        newCount: newGuids.size,
        defunctCount: defunctGuids.size,
      });
    }
  } catch (err) {
    if (err.type === "AbortError") {
      log.error({ msg: "Feed poll timed out", ...logCommon });
    } else {
      log.error({ msg: "Feed poll failed", ...logCommon, error: err.message });
    }

    Object.assign(feedUpdates.metadata, {
      lastFetched: timeStart,
      lastError: err,
      duration: Date.now() - timeStart,
    });
  }

  await db.upsertFeed(feedUpdates);

  return feedItemIds;
}

// Relevant date for an item has a bit of variance, so let's
// work with some fallbacks. Also, treat future dates as *now*,
// since I've seen a few feeds behave badly that way.
export const itemDate = ({ date, pubdate } = {}) => {
  const now = new Date();
  const candidate = new Date(date || pubdate || now);
  return candidate < now ? candidate : now;
};

// Some items don't have a guid, so let's use a hash of the
// title & link as a rough fallback
export const itemGuid = ({ guid, title = "", link = "" }) =>
  guid || crypto.createHash("md5").update(title).update(link).digest("hex");

export function parseFeedStream({ stream, url }) {
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

export function normalizeFeedCharset(response, feed) {
  let charset = detectCharsetFromFeed(response, feed);
  let stream = response.body;
  if (charset && !/utf-*8/i.test(charset)) {
    const iconv = new Iconv(charset, "utf-8");
    stream = stream.pipe(iconv);
  }
  return { stream, charset };
}

export function getContentTypeParams(str) {
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

export function detectCharsetFromFeed(response, feed) {
  const contentType = response.headers.get("content-type");
  const contentTypeParams = getContentTypeParams(contentType || "");
  let charset = contentTypeParams.charset;

  if (!charset && feed.metadata?.charset) {
    // HACK: Try to guess a charset from previous parsing
    // Maybe we need to do a speculative parsing instead to
    // get XML encoding from doctype?
    let prevCharset = feed.metadata?.charset;
    if (!prevCharset) {
      prevCharset = feed.metadata?.feedMeta?.["#xml"].encoding;
    }
    charset = prevCharset;
  }

  if (!charset) {
    charset = Config.get("feedPollDefaultCharset");
  }
  return charset;
}
