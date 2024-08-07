import crypto from "crypto";
import { Iconv } from "iconv";
import FeedParser from "feedparser";

const DEFAULT_FEED_CHARSET = "utf-8";

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
