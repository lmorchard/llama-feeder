import { Config } from "../config.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

import { startServer } from "../webui/server.js";

export default async function (program) {
  program
    .command("serve")
    .description("Run a web UI server")
    .option("--port", "Server port")
    .action(commandServe);
}

async function commandServe(options) {
  const log = Logger.child({ name: "serve" });
  const db = new Database();

  await startServer(log, db, {
    port: options.port || Config.get("serverPort"),
    host: options.host || Config.get("serverHost"),
  });

  db.close();
}
