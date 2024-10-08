// # Thumb Extractor
//
// Handy for extracting thumbs from the web.
//
// Based on ancient code from
// https://github.com/lmorchard/thumb-extractor

import url from "url";
import * as cheerio from "cheerio";
import fetch from "node-fetch";

import PQueue from "p-queue";

import { Config } from "./config.js";

// TODO: Move these constants into config
var REJECTED_URLS = [
  "http://graphics8.nytimes.com/images/common/icons/t_wb_75.gif",
  "https://s0.wp.com/i/blank.jpg",
  "https://www.techmeme.com/img/techmeme_sq328.png",
  "https://www.arcade-museum.com/images/klov_big_logo_crop_250_20PerEdge.jpg",
  "https://vowe.net/assets/vowe201903.jpg",
];
var REJECTED_RES = [
  ".*doubleclick.net.*",
  ".*indieclick.com.*",
  ".*blank.jpg.*",
];

// TODO make a config setting
const TIMEOUT = 3000;

export async function backfillThumbnails(db, log, options = {}) {
  const { concurrency = Config.get("feedPollConcurrency") } = options;

  const jobQueue = new PQueue({ concurrency });

  const queueStatusTimer = setInterval(() => {
    log.debug({
      msg: "Queue status",
      pendingCount: jobQueue.pending,
      queuedCount: jobQueue.size,
    });
  }, 1000);

  const ids = await db.listFeedItemIdsWithoutThumbnails();
  log.info({ msg: "Backfilling thumbnails", count: ids.length });

  await Promise.all(
    ids.map((id) =>
      jobQueue.add(() => fetchThumbnailForFeedItemId(id, db, log), {
        meta: id,
      })
    )
  );

  clearInterval(queueStatusTimer);
}

export async function fetchThumbnailForFeedItemId(id, db, log) {
  let thumbnailUrl = null;

  try {
    const item = await db.fetchFeedItemById(id);
    const { link, thumbnailUrl: existingThumbnailUrl } = item;

    if (existingThumbnailUrl) {
      log.info({ msg: "Skipping thumbnail", id });
      return;
    }

    log.info({ msg: "Seeking thumbnail", id, link });

    thumbnailUrl = await findThumbnailForURL(link);
    if (thumbnailUrl) {
      log.info({ msg: "Found thumbnail", id, thumbnailUrl });
    } else {
      log.info({ msg: "No thumbnail", id });
    }
  } catch (err) {
    if (err.type === "AbortError") {
      log.error({ msg: "Thumbnail fetch timed out", id });
    } else if (err.type === "Error") {
      log.error({ msg: "Thumbnail fetch failed", message: err.message });
    } else {
      log.error({ msg: "Failed to fetch thumbnail", id, message: err.message });
    }
  }

  await db.updateFeedItemThumbnail(id, thumbnailUrl);
}

// ## fetch
export async function findThumbnailForURL(url, timeout = TIMEOUT) {
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": Config.get("userAgent"),
    },
    signal: controller.signal,
  });
  clearTimeout(abortTimeout);

  const body = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("text/html")) {
    return findThumbnailInHTML(url, "");
  }
  return findThumbnailInHTML(url, body);
}

// ## accept
// Consider accepting a thumb URL. Match against reject list. Resolve relative
// URLs to absolute with respect to base URL.
function accept(base_url, thumb_url) {
  // Bail, if there's no URL.
  if (!thumb_url) {
    return null;
  }
  // No data: URLs
  if (thumb_url.startsWith("data:")) {
    return null;
  }
  // Check rejected URLs
  for (var i = 0, reject_url; (reject_url = REJECTED_URLS[i]); i++) {
    if (thumb_url == reject_url) {
      return null;
    }
  }
  // Check rejected regexes
  for (var i = 0, reject_re; (reject_re = REJECTED_RES[i]); i++) {
    var r = new RegExp(reject_re);
    if (r.test(thumb_url)) {
      return null;
    }
  }
  // Resolve any relative URLs to the fetched base URL.
  thumb_url = url.resolve(base_url, thumb_url);
  return thumb_url;
}

// ## find
export function findThumbnailInHTML(base_url, body) {
  var next = function (err, url, kind) {
    return url;
  };

  var $ = cheerio.load(body);
  var meta, thumb_url;

  // Open Graph image
  thumb_url = accept(
    base_url,
    $('meta[property="og:image"]').first().attr("content")
  );
  if (thumb_url) return next(null, thumb_url, "meta_og_image");

  // Twitter thumbnail
  thumb_url = accept(
    base_url,
    $('meta[name="twitter:image"]').first().attr("value")
  );
  if (thumb_url) return next(null, thumb_url, "link_twitter_image");

  // Old-school Facebook thumbnail convention
  thumb_url = accept(base_url, $('link[rel="image_src"]').first().attr("href"));
  if (thumb_url) return next(null, thumb_url, "meta_image_src");

  // Try looking for the largest image in a number of common containers
  var containers = [
    "article",
    ".content",
    ".entry",
    ".postContainer",
    "#article .first .image", // NYT?
    "#comic",
    ".comic",
    "#main-content",
    null, // Last-ditch, try all images everywhere
  ];

  for (let sel of containers) {
    // Assemble the selector, gather images.
    var imgs = $(sel ? sel + " img" : "img");
    if (!imgs.length) {
      continue;
    }

    // Assemble image areas, where available.
    var areas = [];
    imgs.each((idx, img) => {
      // TODO: Use something to discover real dimensions?
      var width = $(img).attr("width") || 0;
      var height = $(img).attr("height") || 0;
      areas.push([width * height, img]);
    });

    // If we got any areas, sort them and use the largest.
    if (areas.length) {
      areas.sort((a, b) => b[0] - a[0]);
      for (let area of areas) {
        thumb_url = accept(base_url, $(area[1]).attr("src"));
        if (thumb_url) return next(null, thumb_url, "largest");
      }
    }
  }

  return next(null, null, "notfound");
}
