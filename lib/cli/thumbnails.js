import PQueue from "p-queue";
import { findThumbnailForURL } from "../thumbnails.js";

import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

let db, log;

export default async function (program) {
  const thumbnailsProgram = program
    .command("thumbnails")
    .description("Thumbnails management commands");

  thumbnailsProgram.hook("preAction", async (command, subcommand) => {
    log = Logger.child({ name: subcommand.name() });
    db = new Database();
  });

  thumbnailsProgram.hook("postAction", async () => {
    await db.close();
  });

  thumbnailsProgram
    .command("backfill")
    .description("Attempt to backfill thumbnails for feed items")
    .action(commandBackfill);
}

async function commandBackfill() {
  const log = Logger.child({ name: "thumbnails:backfill" });
  const db = new Database();

  await backfillThumbnails(db, log);

  await db.close();
}

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
      jobQueue.add(() => backfillThumbnail(id, db, log), {
        meta: id,
      })
    )
  );

  clearInterval(queueStatusTimer);
}

async function backfillThumbnail(id, db, log) {
  let thumbnailUrl = null;

  try {
    const item = await db.fetchFeedItemById(id);
    const { link, thumbnailUrl: existingThumbnailUrl } = item;

    if (existingThumbnailUrl) {
      log.info({ msg: "Skipping backfill", id });
      return;
    }

    log.info({ msg: "Seeking thumbnail", id, link });

    thumbnailUrl = await findThumbnailForURL(link, 1000);
    if (thumbnailUrl) {
      log.info({ msg: "Found thumbnail", id, thumbnailUrl });
    } else {
      log.info({ msg: "No thumbnail", id });
    }
  } catch (err) {
    log.error({ msg: "Failed to backfill thumbnail", id, err });
  }

  await db.updateFeedItemThumbnail(id, thumbnailUrl);
}
