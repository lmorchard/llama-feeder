import { Database } from "../database.js";
import { Logger } from "../logger.js";

let db, log;

export default async function (program) {
  const feedsProgram = program
    .command("feeds")
    .description("Feeds management commands");

  feedsProgram.hook("preAction", async (command, subcommand) => {
    log = Logger.child({ name: subcommand.name() });
    db = new Database();
  });

  feedsProgram.hook("postAction", async () => {
    await db.close();
  });

  feedsProgram
    .command("add")
    .argument("<url>", "Feed URL to add")
    .description("Add a new feed subscription")
    .action(commandAdd);
}

async function commandAdd(url) {
  const log = Logger.child({ name: "feeds:add" });
  const db = new Database();

  const result = await db.upsertFeed({ url });
  log.info({ msg: "Added feed", url, result });

  await db.close();
}
