import crypto from "crypto";
import { Iconv } from "iconv";
import FeedParser from "feedparser";

import { Config } from "./config.js";
import { fetchResource } from "./utils.js";

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
  const commonLogFeedFields = { feedId, title, url };

  try {
    log.debug({ msg: "Feed poll start", ...commonLogFeedFields });

    if (disabled) {
      log.info({ msg: "Feed poll skipped", ...commonLogFeedFields, disabled });
      return;
    }

    const age = timeStart - lastFetched;
    if (!forceFetch && lastFetched !== 0 && age < maxage) {
      log.info({
        msg: "Feed poll skipped",
        ...commonLogFeedFields,
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
      ...commonLogFeedFields,
    });

    if (response.status !== 200) {
      // This is most likely where we hit 304 Not Modified, so skip parsing.
      log.info({ msg: "Feed parse skipped", ...commonLogFeedFields });
    } else {
      let { stream, charset } = normalizeFeedCharset(response, feedUpdates);
      const { meta, items } = await parseFeedStream({ stream, url });

      const existingGuids = new Set(await db.fetchFeedItemGuids(feedId));
      const seenGuids = new Set();

      const itemsToUpsert = [];
      let newestItemDate = null;
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

      const newGuids = seenGuids.difference(existingGuids);
      const defunctGuids = existingGuids.difference(seenGuids);

      for (let item of itemsToUpsert) {
        if (defunctGuids.has(item.guid)) item.defunct = true;
        if (newGuids.has(item.guid)) item.firstSeenAt = Date.now();
        await db.upsertFeedItem(item);
      }

      feedUpdates.newestItemDate = newestItemDate;
      Object.assign(feedUpdates.metadata, {
        charset,
        feedMeta: meta,
        lastParsed: Date.now(),
        parseDuration: Date.now() - timeStart,
      });

      log.info({
        msg: "Feed parse complete",
        ...commonLogFeedFields,
        itemCount: items.length,
        seenCount: seenGuids.size,
        existingCount: existingGuids.size,
        newCount: newGuids.size,
        defunctCount: defunctGuids.size,
      });
    }
  } catch (err) {
    log.error({ msg: "Feed poll failed", ...commonLogFeedFields, err });
    Object.assign(feedUpdates.metadata, {
      lastFetched: timeStart,
      lastError: err,
      duration: Date.now() - timeStart,
    });
  }

  await db.upsertFeed(feedUpdates);
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
