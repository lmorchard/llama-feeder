import fetch from "node-fetch";
import { Config } from "./config.js";
import { Logger } from "./logger.js";

export async function fetchResource({
  url,
  prevHeaders = {},
  timeout = Config.get("fetchTimout"),
  userAgent = Config.get("userAgent"),
  force = false,
  accept = "application/rss+xml, text/rss+xml, text/xml",
}) {
  const log = Logger.child({ module: "fetchResource" });

  const fetchOptions = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      accept,
    },
  };

  // Set up an abort timeout - we're not waiting forever for a feed
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), parseInt(timeout));
  fetchOptions.signal = controller.signal;

  // Set up some headers for conditional GET so we can see
  // some of those sweet 304 Not Modified responses
  if (!force) {
    if (prevHeaders.etag) {
      fetchOptions.headers["If-None-Match"] = prevHeaders.etag;
    }
    if (prevHeaders["last-modified"]) {
      fetchOptions.headers["If-Modified-Match"] = prevHeaders["last-modified"];
    }
  }

  try {
    // Finally, fire off the GET request for the feed resource.
    const response = await fetch(url, fetchOptions);
    clearTimeout(abortTimeout);
    return response;
  } catch (err) {
    clearTimeout(abortTimeout);
    throw err;
  }
}
