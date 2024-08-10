import fs from "fs";
import OpmlParser from "opmlparser";

import { Database } from "../database.js";
import { Logger } from "../logger.js";

export default async function (program) {
  program
    .command("import")
    .description("Import feed subscriptions from an OPML file")
    .argument("<filename>", "Filename to import")
    .action(commandImport);
}

async function commandImport(filename) {
  const log = Logger.child({ name: "import" });
  const db = new Database();

  const stream = fs.createReadStream(filename, { encoding: "utf8" });
  const { meta, items } = await parseOpmlStream({ stream, log });

  for (const item of items) {
    const { text, description = "", xmlurl, htmlurl = "" } = item;
    if (!xmlurl) {
      log.warn({ msg: "Skipping feed", text, description, htmlurl });
      continue;
    }
    const result = await db.upsertFeed({ url: xmlurl, title: text, description, link: htmlurl });
    log.info({ msg: "Imported feed", text, xmlurl, result });
  }

  await db.close();
}

function parseOpmlStream({ stream, log }) {
  return new Promise((resolve, reject) => {
    let meta = {};
    const items = [];

    const parser = new OpmlParser();

    parser.on("error", reject);
    parser.on("end", () => resolve({ meta, items }));
    parser.on("readable", function () {
      meta = this.meta;
      let outline;
      while ((outline = this.read())) {
        items.push(outline);
      }
    });

    stream.pipe(parser);
  });
}
